// Types shared by the browser app and the API. Keep this file dependency-free.

export const SHELVES = ['want_to_read', 'reading', 'read'] as const
export type Shelf = (typeof SHELVES)[number]

export const SHELF_LABELS: Record<Shelf, string> = {
  want_to_read: 'Want to Read',
  reading: 'Currently Reading',
  read: 'Read',
}

export type BookSource = 'openlibrary' | 'google' | 'fixture'

export interface User {
  id: string
  name: string
  email: string | null
  avatarUrl: string | null
  /** The reader's public address: /u/<handle>. */
  handle: string
  /** Whether /u/<handle> shows their shelves to anyone with the link. */
  isPublic: boolean
}

/** What a stranger sees: no email, no notes, nothing private. */
export interface PublicProfile {
  name: string
  handle: string
  avatarUrl: string | null
}

export interface Book {
  id: string
  source: BookSource
  sourceId: string
  title: string
  subtitle: string | null
  authors: string[]
  publishedYear: number | null
  pageCount: number | null
  description: string | null
  genres: string[]
  /** Same-origin cover URL, or null when the book has no cover. */
  coverUrl: string | null
  isbn13: string | null
  spineColor: string | null
}

export interface LibraryEntry {
  id: string
  shelf: Shelf
  position: string
  rating: number | null
  notes: string | null
  /** 'YYYY-MM-DD' */
  startedAt: string | null
  /** 'YYYY-MM-DD' */
  finishedAt: string | null
  /** True when only the year is known (finishedAt is then that year's 31 December). */
  finishedApprox: boolean
  createdAt: number
  updatedAt: number
  book: Book
}

export interface SearchResult {
  source: BookSource
  sourceId: string
  title: string
  authors: string[]
  publishedYear: number | null
  pageCount: number | null
  /** Remote thumbnail, for display only. */
  thumbnailUrl: string | null
}

export interface ReadingStats {
  year: number
  booksRead: number
  pagesRead: number
  goal: number | null
  /** Books finished per month, January first. */
  byMonth: number[]
  topGenres: { genre: string; count: number }[]
  averageRating: number | null
  currentlyReading: number
  libraryTotal: number
}

/** One book from an imported reading list, before it is matched to the catalogue. */
export interface ImportRow {
  title: string
  author: string | null
  isbn: string | null
  shelf: Shelf
  rating: number | null
  /** 'YYYY-MM-DD' when the list knows the day. */
  finishedAt: string | null
  /** The year, when that is all the list knows. */
  finishedYear: number | null
  notes: string | null
  /** A genre from the list's own grouping, used when the catalogue has none. */
  genreHint: string | null
}

export type ImportOutcome =
  | { status: 'added'; title: string; entry: LibraryEntry }
  | { status: 'exists'; title: string }
  | { status: 'unmatched'; title: string; author: string | null }
  | { status: 'retry'; title: string }
