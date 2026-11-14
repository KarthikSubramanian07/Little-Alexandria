// The whole storage layer: every SQL statement in the app lives here.
// Every library query is scoped by the user id the session resolved, so one
// reader can never name another reader's rows.
import { frontOf } from '../shared/positions'
import { datesForShelf } from '../shared/shelf-rules'
import type { Book, LibraryEntry, PublicProfile, Shelf, User } from '../shared/types'
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
  finished_approx: number
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

interface UserRow {
  id: string
  name: string
  email: string | null
  avatar_url: string | null
  handle: string | null
  is_public: number
}

const ENTRY_SELECT = `
  SELECT ub.id, ub.shelf, ub.position, ub.rating, ub.notes, ub.started_at, ub.finished_at,
         ub.finished_approx, ub.created_at, ub.updated_at,
         b.id AS book_id, b.source, b.source_id, b.title, b.subtitle, b.authors, b.published_year,
         b.page_count, b.description, b.genres, b.cover_url, b.isbn13, b.spine_color
  FROM user_books ub JOIN books b ON b.id = ub.book_id`

const USER_SELECT = 'SELECT id, name, email, avatar_url, handle, is_public FROM users'

const toEntry = (row: EntryRow): LibraryEntry => ({
  id: row.id,
  shelf: row.shelf,
  position: row.position,
  rating: row.rating,
  notes: row.notes,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  finishedApprox: row.finished_approx === 1,
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

const toUser = (row: UserRow): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  avatarUrl: row.avatar_url,
  handle: row.handle ?? '',
  isPublic: row.is_public === 1,
})

const isConstraint = (error: unknown, kind: 'UNIQUE' | 'CHECK') =>
  error instanceof Error && error.message.includes(`${kind} constraint failed`)

/** Addresses that would collide with the app's own pages. */
export const RESERVED_HANDLES = new Set([
  'api',
  'app',
  'admin',
  'about',
  'garden',
  'library',
  'login',
  'logout',
  'settings',
  'help',
  'u',
  'me',
  'discover',
  'import',
  'share',
  'support',
  'little-alexandria',
  'alexandria',
])

/** "Karthik Subramanian" -> "karthik-subramanian". Never too short, never reserved. */
function slugifyHandle(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/g, '')
  if (slug.length < 3 || RESERVED_HANDLES.has(slug)) return `reader-${slug || 'x'}`.slice(0, 24)
  return slug
}

interface EntryDetails {
  rating?: number | null
  notes?: string | null
  finishedAt?: string | null
  finishedApprox?: boolean
  genreHint?: string | null
}

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

  async function getUser(id: string) {
    const row = await db.prepare(`${USER_SELECT} WHERE id = ?`).bind(id).first<UserRow>()
    return row ? toUser(row) : null
  }

  /** The first free handle based on `base`: karthik, karthik-2, karthik-3… */
  async function freeHandle(base: string, userId: string) {
    for (let n = 1; n < 50; n++) {
      const candidate = n === 1 ? base : `${base.slice(0, 21)}-${n}`
      const taken = await db
        .prepare('SELECT id FROM users WHERE handle = ? AND id != ?')
        .bind(candidate, userId)
        .first()
      if (!taken) return candidate
    }
    return `${base.slice(0, 15)}-${crypto.randomUUID().slice(0, 8)}`
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

    // ── Readers ─────────────────────────────────────────────────────────────
    getUser,

    /** Create the reader on first sign-in (with a handle); refresh their name and photo after. */
    async upsertUser(
      sub: string,
      profile: Pick<User, 'name' | 'email' | 'avatarUrl'>,
    ): Promise<User> {
      const row = await db
        .prepare(
          `INSERT INTO users (id, google_sub, email, name, avatar_url, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (google_sub) DO UPDATE SET
             email = excluded.email, name = excluded.name, avatar_url = excluded.avatar_url
           RETURNING id, name, email, avatar_url, handle, is_public`,
        )
        .bind(crypto.randomUUID(), sub, profile.email, profile.name, profile.avatarUrl, Date.now())
        .first<UserRow>()
      const user = toUser(row!)
      if (user.handle) return user
      // Two new readers with the same name can race for the same handle; the
      // unique index settles it, and the loser simply takes the next one.
      for (let attempt = 0; attempt < 5; attempt++) {
        const handle = await freeHandle(slugifyHandle(profile.name), user.id)
        try {
          await db.prepare('UPDATE users SET handle = ? WHERE id = ?').bind(handle, user.id).run()
          return { ...user, handle }
        } catch (error) {
          if (!isConstraint(error, 'UNIQUE')) throw error
        }
      }
      throw new Error('Could not find a free handle')
    },

    /** Delete a reader and, by cascade, their sessions, shelves, and goals. Catalogue rows stay. */
    async deleteUser(userId: string) {
      await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run()
    },

    async updateProfile(userId: string, changes: { handle?: string; isPublic?: boolean }) {
      try {
        if (changes.handle !== undefined) {
          await db
            .prepare('UPDATE users SET handle = ? WHERE id = ?')
            .bind(changes.handle, userId)
            .run()
        }
        if (changes.isPublic !== undefined) {
          await db
            .prepare('UPDATE users SET is_public = ? WHERE id = ?')
            .bind(changes.isPublic ? 1 : 0, userId)
            .run()
        }
      } catch (error) {
        if (isConstraint(error, 'UNIQUE')) throw new LibraryError('That address is taken', 409)
        throw error
      }
      return (await getUser(userId))!
    },

    /** Every shared library's handle, newest first, for the sitemap. */
    async publicHandles(limit = 5000) {
      const { results } = await db
        .prepare(
          'SELECT handle FROM users WHERE is_public = 1 AND handle IS NOT NULL ORDER BY created_at DESC LIMIT ?',
        )
        .bind(limit)
        .all<{ handle: string }>()
      return results.map((row) => row.handle)
    },

    /** A shared library, or null when it doesn't exist or isn't shared. Notes stay private. */
    async publicLibrary(handle: string) {
      const row = await db
        .prepare(`${USER_SELECT} WHERE handle = ? AND is_public = 1`)
        .bind(handle)
        .first<UserRow>()
      if (!row) return null
      const { results } = await db
        .prepare(`${ENTRY_SELECT} WHERE ub.user_id = ? ORDER BY ub.shelf, ub.position`)
        .bind(row.id)
        .all<EntryRow>()
      const profile: PublicProfile = {
        name: row.name,
        handle: row.handle!,
        avatarUrl: row.avatar_url,
      }
      return {
        userId: row.id,
        profile,
        entries: results.map((r) => ({ ...toEntry(r), notes: null })),
      }
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
    async addEntry(
      userId: string,
      book: Book,
      shelf: Shelf,
      today: string,
      details: EntryDetails = {},
    ) {
      const now = Date.now()
      const stamped = datesForShelf(
        { shelf: 'want_to_read', startedAt: null, finishedAt: null },
        shelf,
        today,
      )
      // An import that knows when a book was finished doesn't pretend it was today.
      const known = shelf === 'read' && details.finishedAt
      const finishedAt = known ? details.finishedAt! : stamped.finishedAt
      const startedAt = known ? null : stamped.startedAt
      const genres =
        book.genres.length === 0 && details.genreHint ? [details.genreHint] : book.genres
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
              JSON.stringify(genres),
              book.coverUrl,
              book.isbn13,
              now,
            ),
          db
            .prepare(
              `INSERT INTO user_books (id, user_id, book_id, shelf, position, rating, notes, started_at,
                 finished_at, finished_approx, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              id,
              userId,
              book.id,
              shelf,
              position,
              details.rating ?? null,
              details.notes ?? null,
              startedAt,
              finishedAt,
              known && details.finishedApprox ? 1 : 0,
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

    async hasBook(userId: string, bookId: string) {
      const row = await db
        .prepare('SELECT id FROM user_books WHERE user_id = ? AND book_id = ?')
        .bind(userId, bookId)
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
               finished_at = ?, finished_approx = ?, updated_at = ?
             WHERE user_id = ? AND id = ?`,
          )
          .bind(
            next.shelf,
            next.position,
            next.rating,
            next.notes,
            next.startedAt,
            next.finishedAt,
            next.finishedApprox ? 1 : 0,
            next.updatedAt,
            userId,
            id,
          )
          .run()
      } catch (error) {
        if (isConstraint(error, 'UNIQUE')) {
          throw new LibraryError('Another book already sits in that spot', 409)
        }
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

    /** Fill in a catalogue description the import skipped. Never overwrites one. */
    async setDescription(bookId: string, description: string) {
      await db
        .prepare('UPDATE books SET description = ? WHERE id = ? AND description IS NULL')
        .bind(description, bookId)
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
