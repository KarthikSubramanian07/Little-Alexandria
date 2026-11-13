import type { LibraryEntry, Shelf } from './types'

// Goodreads' column names and shelf names, so an export can go anywhere.
const SHELF_NAMES: Record<Shelf, string> = {
  want_to_read: 'to-read',
  reading: 'currently-reading',
  read: 'read',
}

const cell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const slashes = (iso: string | null) => (iso ? iso.replaceAll('-', '/') : '')

/** The whole library as a Goodreads-compatible CSV. */
export function libraryToCsv(entries: LibraryEntry[]): string {
  const header = [
    'Title',
    'Author',
    'ISBN13',
    'Exclusive Shelf',
    'My Rating',
    'Date Started',
    'Date Read',
    'Year Published',
    'Number of Pages',
    'Genres',
    'My Review',
  ]
  const rows = entries.map((entry) => [
    entry.book.title,
    entry.book.authors.join(', '),
    entry.book.isbn13,
    SHELF_NAMES[entry.shelf],
    entry.rating ?? 0,
    slashes(entry.startedAt),
    entry.finishedApprox ? (entry.finishedAt?.slice(0, 4) ?? '') : slashes(entry.finishedAt),
    entry.book.publishedYear,
    entry.book.pageCount,
    entry.book.genres.join('; '),
    entry.notes,
  ])
  return [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
