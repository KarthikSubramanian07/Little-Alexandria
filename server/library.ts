// Pure rules about shelves, ordering, and stats. No I/O lives here, so every
// rule is trivially testable; server/store.ts does the SQL.
import type { Book, LibraryEntry, ReadingStats, Shelf } from '../shared/types'
import type { BookMetadata } from './sources/types'

export const bookId = (source: string, sourceId: string) => `${source}:${sourceId}`

const ALLOWED_COVER_HOSTS = new Set(['covers.openlibrary.org', 'books.google.com'])

const isAllowedCoverHost = (url: URL) =>
  url.protocol === 'https:' && url.port === '' && ALLOWED_COVER_HOSTS.has(url.hostname)

/**
 * A cover URL in the exact shape our sources produce. Anything else (odd paths,
 * extra query strings that would dodge the cache) is refused by the proxy.
 */
export function isCanonicalCover(url: URL): boolean {
  if (!isAllowedCoverHost(url) || url.username || url.password || url.hash) return false
  if (url.hostname === 'covers.openlibrary.org') {
    return (
      /^\/b\/(id|isbn|olid)\/[A-Za-z0-9-]{1,40}-[SML]\.jpg$/.test(url.pathname) &&
      (url.search === '' || url.search === '?default=false')
    )
  }
  return url.pathname.startsWith('/books/')
}

/** Where a cover host may send us on the way to the image: its own archives and CDNs. */
export const isAllowedCoverRedirect = (url: URL) =>
  url.protocol === 'https:' &&
  url.port === '' &&
  (isAllowedCoverHost(url) ||
    url.hostname === 'archive.org' ||
    url.hostname.endsWith('.archive.org') ||
    url.hostname.endsWith('.googleusercontent.com'))

/** The raster formats a cover may be. SVG never: it could carry script. */
export const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/** Covers are served through our own origin so the browser can read their colours. */
export function proxiedCover(remote: string | null): string | null {
  if (!remote) return null
  try {
    return isAllowedCoverHost(new URL(remote))
      ? `/api/cover?src=${encodeURIComponent(remote)}`
      : null
  } catch {
    return null
  }
}

export function bookFromMetadata(metadata: BookMetadata): Book {
  return {
    id: bookId(metadata.source, metadata.sourceId),
    source: metadata.source,
    sourceId: metadata.sourceId,
    title: metadata.title,
    subtitle: metadata.subtitle,
    authors: metadata.authors,
    publishedYear: metadata.publishedYear,
    pageCount: metadata.pageCount,
    description: metadata.description,
    genres: metadata.genres,
    coverUrl: proxiedCover(metadata.coverUrl),
    isbn13: metadata.isbn13,
    spineColor: null,
  }
}

export { comparePositions, frontOf } from '../shared/positions'

export class LibraryError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message)
  }
}

export interface EntryPatch {
  shelf?: Shelf
  position?: string
  rating?: number | null
  notes?: string | null
  startedAt?: string | null
  finishedAt?: string | null
}

/**
 * Apply a reader's edit to an entry. `frontOfTarget` is the key at the front of
 * the destination shelf, used when a book changes shelf without a position.
 */
export function applyPatch(
  entry: LibraryEntry,
  patch: EntryPatch,
  frontOfTarget: () => string,
  now: number,
): LibraryEntry {
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as EntryPatch
  const next: LibraryEntry = { ...entry, ...defined, updatedAt: now }
  if (patch.notes !== undefined) next.notes = patch.notes?.trim() ? patch.notes : null
  // A reader who sets a finish date by hand knows the day, not just the year.
  if (patch.finishedAt !== undefined) next.finishedApprox = false
  if (next.startedAt && next.finishedAt && next.finishedAt < next.startedAt) {
    throw new LibraryError('A book can’t be finished before it was started', 400)
  }
  if (patch.shelf && patch.shelf !== entry.shelf && !patch.position) next.position = frontOfTarget()
  return next
}

export function computeStats(
  entries: LibraryEntry[],
  goals: Record<string, number>,
  year: number,
): ReadingStats {
  const prefix = String(year)
  const finishedThisYear = entries.filter(
    (entry) => entry.shelf === 'read' && entry.finishedAt?.startsWith(prefix),
  )
  const byMonth = Array.from({ length: 12 }, () => 0)
  // Books known only by year count toward the total but not toward any one month.
  for (const entry of finishedThisYear) {
    if (!entry.finishedApprox) byMonth[Number(entry.finishedAt!.slice(5, 7)) - 1]!++
  }

  // Favourite genres: everything you've read, with books you loved counting double.
  const genreWeights = new Map<string, number>()
  for (const entry of entries) {
    if (entry.shelf !== 'read') continue
    const weight = (entry.rating ?? 3) >= 4 ? 2 : 1
    for (const genre of entry.book.genres) {
      genreWeights.set(genre, (genreWeights.get(genre) ?? 0) + weight)
    }
  }
  const topGenres = [...genreWeights]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([genre, count]) => ({ genre, count }))

  const ratings = finishedThisYear.flatMap((entry) => (entry.rating ? [entry.rating] : []))
  return {
    year,
    booksRead: finishedThisYear.length,
    pagesRead: finishedThisYear.reduce((sum, entry) => sum + (entry.book.pageCount ?? 0), 0),
    goal: goals[prefix] ?? null,
    byMonth,
    topGenres,
    averageRating: ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null,
    currentlyReading: entries.filter((entry) => entry.shelf === 'reading').length,
    libraryTotal: entries.length,
  }
}
