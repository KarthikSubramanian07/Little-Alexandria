// Turning other people's spreadsheets into shelves. Recognises Goodreads and
// StoryGraph exports, and plain "title, author[, year read]" lists where a
// blank author means "same as the row above".
import { SHELVES, type ImportRow, type Shelf } from './types'

/** A small RFC 4180 parser: quoted fields, doubled quotes, CRLF, stray tabs. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const input = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i++) {
    const char = input[i]!
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += char
    } else if (char === '"' && field.trim() === '') {
      quoted = true
      field = ''
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
    .map((cells) => cells.map((cell) => cell.replace(/\s+/g, ' ').trim()))
    .filter((cells) => cells.some((cell) => cell !== ''))
}

const isShelf = (value: string): value is Shelf => (SHELVES as readonly string[]).includes(value)

/** "2023/05/12" or "2023-05-12" -> "2023-05-12"; anything else -> null. */
export function toIsoDate(value: string | undefined): string | null {
  const match = value?.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (!match) return null
  const iso = `${match[1]}-${match[2]!.padStart(2, '0')}-${match[3]!.padStart(2, '0')}`
  const date = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso
}

/** Goodreads wraps ISBNs as ="9780...". Keep digits (and a trailing X). */
const cleanIsbn = (value: string | undefined) => {
  const digits = value?.replace(/[^0-9Xx]/g, '') ?? ''
  return digits.length === 13 || digits.length === 10 ? digits.toUpperCase() : null
}

const ratingFrom = (value: string | undefined) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 1 ? Math.min(5, Math.round(number)) : null
}

const GOODREADS_SHELVES: Record<string, Shelf> = {
  read: 'read',
  'currently-reading': 'reading',
  'to-read': 'want_to_read',
  // StoryGraph's names for the same idea.
  'to read': 'want_to_read',
  'did-not-finish': 'want_to_read',
}

/** A genre hint from a file name like "Books List - Sci-Fi.csv". */
export function hintsFromFileName(name: string): { shelf: Shelf; genre: string | null } {
  const base = name.replace(/\.csv$/i, '')
  const tail = (base.split(' - ').at(-1) ?? base).trim()
  const lower = tail.toLowerCase()
  if (/\b(currently|reading now|in progress)\b/.test(lower))
    return { shelf: 'reading', genre: null }
  if (/^(read|finished|done|have read|books read)$/.test(lower))
    return { shelf: 'read', genre: null }
  if (/\b(want|to[- ]read|tbr|wishlist)\b/.test(lower))
    return { shelf: 'want_to_read', genre: null }
  const genres: Record<string, string> = {
    'sci-fi': 'Science Fiction',
    scifi: 'Science Fiction',
    'science fiction': 'Science Fiction',
    fiction: 'Literary Fiction',
    history: 'History',
    'self-help': 'Self-Help',
    'self help': 'Self-Help',
    thriller: 'Thriller',
    thrillers: 'Thriller',
    fantasy: 'Fantasy',
    mystery: 'Mystery',
    romance: 'Romance',
    biography: 'Biography',
    memoir: 'Memoir',
    poetry: 'Poetry',
    philosophy: 'Philosophy',
    science: 'Science',
    business: 'Business',
    classics: 'Classics',
  }
  return { shelf: 'want_to_read', genre: genres[lower] ?? null }
}

export interface ParsedList {
  format: 'goodreads' | 'storygraph' | 'simple'
  rows: ImportRow[]
}

export function parseReadingList(text: string, fileName = ''): ParsedList {
  const table = parseCsv(text)
  if (table.length === 0) return { format: 'simple', rows: [] }
  const header = table[0]!.map((cell) => cell.toLowerCase())
  const column = (name: string) => header.indexOf(name)

  if (column('exclusive shelf') !== -1 && column('title') !== -1) {
    const at = (cells: string[], name: string) => cells[column(name)]
    return {
      format: 'goodreads',
      rows: table.slice(1).flatMap((cells): ImportRow[] => {
        const title = at(cells, 'title')
        if (!title) return []
        const shelf =
          GOODREADS_SHELVES[at(cells, 'exclusive shelf')?.toLowerCase() ?? ''] ?? 'want_to_read'
        return [
          {
            title,
            author: at(cells, 'author') || null,
            isbn: cleanIsbn(at(cells, 'isbn13')) ?? cleanIsbn(at(cells, 'isbn')),
            shelf,
            rating: ratingFrom(at(cells, 'my rating')),
            finishedAt: shelf === 'read' ? toIsoDate(at(cells, 'date read')) : null,
            finishedYear: null,
            notes: at(cells, 'my review') || at(cells, 'private notes') || null,
            genreHint: null,
          },
        ]
      }),
    }
  }

  if (column('read status') !== -1 && column('title') !== -1) {
    const at = (cells: string[], name: string) => cells[column(name)]
    return {
      format: 'storygraph',
      rows: table.slice(1).flatMap((cells): ImportRow[] => {
        const title = at(cells, 'title')
        if (!title) return []
        const status = at(cells, 'read status')?.toLowerCase() ?? ''
        const shelf = GOODREADS_SHELVES[status] ?? (isShelf(status) ? status : 'want_to_read')
        return [
          {
            title,
            author: at(cells, 'authors')?.split(',')[0]?.trim() || null,
            isbn: cleanIsbn(at(cells, 'isbn/uid')),
            shelf,
            rating: ratingFrom(at(cells, 'star rating')),
            finishedAt: shelf === 'read' ? toIsoDate(at(cells, 'last date read')) : null,
            finishedYear: null,
            notes: at(cells, 'review') || null,
            genreHint: null,
          },
        ]
      }),
    }
  }

  // A plain list. Skip a header row if it looks like one.
  const hints = hintsFromFileName(fileName)
  const body = /^(title|book|name)$/i.test(table[0]![0] ?? '') ? table.slice(1) : table
  let lastAuthor: string | null = null
  const rows = body.flatMap((cells): ImportRow[] => {
    const [title, rawAuthor, third] = cells
    if (!title) return []
    const author = rawAuthor ? rawAuthor : lastAuthor
    if (rawAuthor) lastAuthor = rawAuthor
    const year = third && /^\d{4}$/.test(third) ? Number(third) : null
    const shelf = year ? 'read' : hints.shelf
    return [
      {
        title,
        author,
        isbn: null,
        shelf,
        rating: null,
        finishedAt: null,
        finishedYear: shelf === 'read' ? year : null,
        notes: null,
        genreHint: hints.genre,
      },
    ]
  })
  return { format: 'simple', rows }
}

/** One row per book across every file. When a book appears twice, the furthest-along shelf wins. */
export function mergeRows(rows: ImportRow[]): ImportRow[] {
  const rank: Record<Shelf, number> = { read: 3, reading: 2, want_to_read: 1 }
  const byKey = new Map<string, ImportRow>()
  for (const row of rows) {
    const key = `${row.title.toLowerCase().replace(/[^a-z0-9]/g, '')}|${(row.author ?? '').toLowerCase().replace(/[^a-z]/g, '')}`
    const existing = byKey.get(key)
    if (!existing || rank[row.shelf] > rank[existing.shelf]) {
      byKey.set(key, existing ? { ...row, genreHint: row.genreHint ?? existing.genreHint } : row)
    } else if (!existing.genreHint && row.genreHint) {
      existing.genreHint = row.genreHint
    }
  }
  return [...byKey.values()]
}
