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
