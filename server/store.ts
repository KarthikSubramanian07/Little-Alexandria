// The whole storage layer: every SQL statement in the app lives here.
// Every library query is scoped by the user id the session resolved, so one
// reader can never name another reader's rows.
import { datesForShelf } from '../shared/shelf-rules'
import type { Book, LibraryEntry, Shelf, User } from '../shared/types'
import { frontOf } from '../shared/positions'
import { LibraryError, applyPatch, type EntryPatch } from './library'

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30

interface EntryRow {
  id: string
  shelf: Shelf
  position: string
  rating: number | null
  notes: string | null
  started_at: string | null
  finished_at: string | null
  created_at: number
  updated_at: number
  book_id: string
  source: Book['source']
  source_id: string
  title: string
  subtitle: string | null
  authors: string
  published_year: number | null
  page_count: number | null
  description: string | null
  genres: string
  cover_url: string | null
  isbn13: string | null
  spine_color: string | null
}

const ENTRY_SELECT = `
  SELECT ub.id, ub.shelf, ub.position, ub.rating, ub.notes, ub.started_at, ub.finished_at,
         ub.created_at, ub.updated_at,
         b.id AS book_id, b.source, b.source_id, b.title, b.subtitle, b.authors, b.published_year,
         b.page_count, b.description, b.genres, b.cover_url, b.isbn13, b.spine_color
  FROM user_books ub JOIN books b ON b.id = ub.book_id`

const toEntry = (row: EntryRow): LibraryEntry => ({
  id: row.id,
  shelf: row.shelf,
  position: row.position,
  rating: row.rating,
  notes: row.notes,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  book: {
    id: row.book_id,
    source: row.source,
    sourceId: row.source_id,
    title: row.title,
    subtitle: row.subtitle,
    authors: JSON.parse(row.authors) as string[],
    publishedYear: row.published_year,
    pageCount: row.page_count,
    description: row.description,
    genres: JSON.parse(row.genres) as string[],
    coverUrl: row.cover_url,
    isbn13: row.isbn13,
    spineColor: row.spine_color,
  },
})

const isConstraint = (error: unknown, kind: 'UNIQUE' | 'CHECK') =>
  error instanceof Error && error.message.includes(`${kind} constraint failed`)

export function createStore(db: D1Database) {
  async function firstPosition(userId: string, shelf: Shelf) {
    const row = await db
      .prepare('SELECT MIN(position) AS p FROM user_books WHERE user_id = ? AND shelf = ?')
      .bind(userId, shelf)
      .first<{ p: string | null }>()
    return row?.p ?? null
  }

  async function getEntry(userId: string, id: string) {
    const row = await db
      .prepare(`${ENTRY_SELECT} WHERE ub.user_id = ? AND ub.id = ?`)
      .bind(userId, id)
      .first<EntryRow>()
    if (!row) throw new LibraryError('That book is not on your shelves', 404)
    return toEntry(row)
  }

  return {
    // ── Sessions ────────────────────────────────────────────────────────────
    async getSession(id: string) {
      return db
        .prepare(
          'SELECT user_id AS userId, expires_at AS expiresAt FROM sessions WHERE id = ? AND expires_at > ?',
        )
        .bind(id, Date.now())
        .first<{ userId: string; expiresAt: number }>()
    },
    async putSession(id: string, userId: string, expiresAt: number) {
      await db
        .prepare(
          `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET expires_at = excluded.expires_at`,
        )
        .bind(id, userId, expiresAt)
        .run()
      // Opportunistic sweep, so expired sessions never pile up.
      if (Math.random() < 0.05) {
        await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Date.now()).run()
      }
    },
    async deleteSession(id: string) {
      await db.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run()
    },

    // ── Users ───────────────────────────────────────────────────────────────
    async getUser(id: string) {
      return db
        .prepare('SELECT id, name, email, avatar_url AS avatarUrl FROM users WHERE id = ?')
        .bind(id)
        .first<User>()
    },
    /** Create the reader on first sign-in; refresh their name and photo after. */
    async upsertUser(sub: string, profile: Omit<User, 'id'>): Promise<User> {
      const user = await db
        .prepare(
          `INSERT INTO users (id, google_sub, email, name, avatar_url, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (google_sub) DO UPDATE SET
             email = excluded.email, name = excluded.name, avatar_url = excluded.avatar_url
           RETURNING id, name, email, avatar_url AS avatarUrl`,
        )
        .bind(crypto.randomUUID(), sub, profile.email, profile.name, profile.avatarUrl, Date.now())
        .first<User>()
      return user!
    },

    // ── Library ─────────────────────────────────────────────────────────────
    async listEntries(userId: string) {
      const { results } = await db
        .prepare(`${ENTRY_SELECT} WHERE ub.user_id = ? ORDER BY ub.shelf, ub.position`)
        .bind(userId)
        .all<EntryRow>()
      return results.map(toEntry)
    },

    getEntry,

    /** Catalogue the book if it is new, then put it at the front of the shelf. */
    async addEntry(userId: string, book: Book, shelf: Shelf, today: string) {
      const now = Date.now()
      const dates = datesForShelf(
        { shelf: 'want_to_read', startedAt: null, finishedAt: null },
        shelf,
        today,
      )
      const id = crypto.randomUUID()
      const position = frontOf(await firstPosition(userId, shelf))
      try {
        await db.batch([
          db
            .prepare(
              `INSERT INTO books (id, source, source_id, title, subtitle, authors, published_year,
                 page_count, description, genres, cover_url, isbn13, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT (id) DO NOTHING`,
            )
            .bind(
              book.id,
              book.source,
              book.sourceId,
              book.title,
              book.subtitle,
              JSON.stringify(book.authors),
              book.publishedYear,
              book.pageCount,
              book.description,
              JSON.stringify(book.genres),
              book.coverUrl,
              book.isbn13,
              now,
            ),
          db
            .prepare(
              `INSERT INTO user_books (id, user_id, book_id, shelf, position, started_at, finished_at,
                 created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              id,
              userId,
              book.id,
              shelf,
              position,
              dates.startedAt,
              dates.finishedAt,
              now,
              now,
            ),
        ])
      } catch (error) {
        if (isConstraint(error, 'UNIQUE')) throw new LibraryError('Already on your shelves', 409)
        throw error
      }
      return getEntry(userId, id)
    },

    async hasBook(userId: string, id: string) {
      const row = await db
        .prepare('SELECT id FROM user_books WHERE user_id = ? AND book_id = ?')
        .bind(userId, id)
        .first<{ id: string }>()
      return row?.id ?? null
    },

    async updateEntry(userId: string, id: string, patch: EntryPatch) {
      const entry = await getEntry(userId, id)
      const target = patch.shelf && patch.shelf !== entry.shelf ? patch.shelf : null
      const front = target ? frontOf(await firstPosition(userId, target)) : entry.position
      const next = applyPatch(entry, patch, () => front, Date.now())
      try {
        await db
          .prepare(
            `UPDATE user_books SET shelf = ?, position = ?, rating = ?, notes = ?, started_at = ?,
               finished_at = ?, updated_at = ?
             WHERE user_id = ? AND id = ?`,
          )
          .bind(
            next.shelf,
            next.position,
            next.rating,
            next.notes,
            next.startedAt,
            next.finishedAt,
            next.updatedAt,
            userId,
            id,
          )
          .run()
      } catch (error) {
        if (isConstraint(error, 'UNIQUE'))
          throw new LibraryError('Another book already sits in that spot', 409)
        if (isConstraint(error, 'CHECK')) throw new LibraryError('Those details don’t add up', 400)
        throw error
      }
      return next
    },

    async removeEntry(userId: string, id: string) {
      const result = await db
        .prepare('DELETE FROM user_books WHERE user_id = ? AND id = ?')
        .bind(userId, id)
        .run()
      if (result.meta.changes === 0) throw new LibraryError('That book is not on your shelves', 404)
    },

    /**
     * Spine colours are sampled in the browser and shared through the catalogue.
     * A reader may only colour a book on their own shelves, and only once.
     */
    async setSpineColor(userId: string, entryId: string, color: string) {
      const entry = await getEntry(userId, entryId)
      await db
        .prepare('UPDATE books SET spine_color = ? WHERE id = ? AND spine_color IS NULL')
        .bind(color, entry.book.id)
        .run()
    },

    // ── Goals ───────────────────────────────────────────────────────────────
    async getGoals(userId: string) {
      const { results } = await db
        .prepare('SELECT year, target FROM reading_goals WHERE user_id = ?')
        .bind(userId)
        .all<{ year: number; target: number }>()
      return Object.fromEntries(results.map((row) => [String(row.year), row.target]))
    },
    async setGoal(userId: string, year: number, target: number) {
      await db
        .prepare(
          `INSERT INTO reading_goals (user_id, year, target) VALUES (?, ?, ?)
           ON CONFLICT (user_id, year) DO UPDATE SET target = excluded.target`,
        )
        .bind(userId, year, target)
        .run()
    },
  }
}

export type Store = ReturnType<typeof createStore>
