import type { SearchResult } from '../../shared/types'
import { normalizeGenres } from './genres'
import { cleanOpenLibraryDescription, isbn13From } from './text'
import { bestMatch, exactPopular, splitAuthors } from './match'
import { SourceError, type BookMetadata, type BookSourceClient } from './types'

const BASE = 'https://openlibrary.org'
const FIELDS =
  'key,title,subtitle,author_name,first_publish_year,cover_i,number_of_pages_median,subject,isbn,edition_count,editions,editions.cover_i,editions.language'
// Open Library asks clients to identify themselves; this raises the rate limit.
const HEADERS = { 'User-Agent': 'LittleAlexandria/1.0 (+https://little-alexandria.pages.dev)' }

export interface SearchDoc {
  key: string
  title: string
  subtitle?: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
  number_of_pages_median?: number
  subject?: string[]
  isbn?: string[]
  edition_count?: number
  /** With lang=en, the edition that best matches the query, English first. */
  editions?: { docs?: { cover_i?: number; language?: string[] }[] }
}

/** The English edition's cover when there is one; the work's chosen cover otherwise. */
export function coverIdFor(doc: SearchDoc): number | null {
  const edition = doc.editions?.docs?.[0]
  if (edition?.cover_i && (!edition.language || edition.language.includes('eng')))
    return edition.cover_i
  return doc.cover_i ?? null
}

const coverById = (id: number, size: 'M' | 'L') =>
  `https://covers.openlibrary.org/b/id/${id}-${size}.jpg?default=false`

/** "/works/OL123W" -> "OL123W" */
const workId = (key: string) => key.replace('/works/', '')

async function searchDocs(
  query: string | Record<string, string>,
  limit: number,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams(typeof query === 'string' ? { q: query } : query)
  const url = `${BASE}/search.json?${params}&fields=${FIELDS}&limit=${limit}&lang=en`
  const response = await fetch(url, { headers: HEADERS, signal })
  if (!response.ok) throw new SourceError(`Open Library search failed`, response.status)
  const body = (await response.json()) as { docs?: SearchDoc[] }
  return body.docs ?? []
}

export function toSearchResult(doc: SearchDoc): SearchResult {
  return {
    source: 'openlibrary',
    sourceId: workId(doc.key),
    title: doc.title,
    authors: doc.author_name?.slice(0, 3) ?? [],
    publishedYear: doc.first_publish_year ?? null,
    pageCount: doc.number_of_pages_median ?? null,
    thumbnailUrl: coverIdFor(doc) ? coverById(coverIdFor(doc)!, 'M') : null,
  }
}

/** Everything the search index knows, without the extra trip for a description. */
function metadataFromDoc(doc: SearchDoc): BookMetadata {
  const cover = coverIdFor(doc)
  return {
    source: 'openlibrary',
    sourceId: workId(doc.key),
    title: doc.title,
    subtitle: doc.subtitle ?? null,
    authors: doc.author_name?.slice(0, 5) ?? [],
    publishedYear: doc.first_publish_year ?? null,
    pageCount: doc.number_of_pages_median ?? null,
    description: null,
    genres: normalizeGenres(doc.subject ?? []),
    coverUrl: cover ? coverById(cover, 'L') : null,
    isbn13: isbn13From(doc.isbn),
  }
}

/** Find the work a reading-list row means: by ISBN, then title and author, then a forgiving search. */
export async function matchOpenLibrary(row: {
  title: string
  author: string | null
  isbn: string | null
}): Promise<BookMetadata | null> {
  if (row.isbn) {
    const [doc] = await searchDocs({ isbn: row.isbn }, 1)
    if (doc?.key?.startsWith('/works/')) return metadataFromDoc(doc)
  }
  const title = row.title.split(/[:(]/)[0]!.trim() || row.title
  const author = splitAuthors(row.author)[0] ?? null
  const asCandidates = (docs: SearchDoc[]) =>
    docs
      .filter((doc) => doc.key?.startsWith('/works/'))
      .map((doc) => ({ ...doc, authors: doc.author_name ?? [], editionCount: doc.edition_count }))

  // 1. Title and author as separate fields; the catalogue matches the author in any script.
  const strict = asCandidates(await searchDocs(author ? { title, author } : { title }, 10))
  const found = bestMatch(row.title, row.author, strict, { trustAuthor: Boolean(author) })
  if (found) return metadataFromDoc(found)
  if (!author) return null

  // 2. Free text, which survives translated titles ("The Stranger" is "L'Étranger").
  const loose = asCandidates(await searchDocs(`${title} ${author}`, 10))
  const fallback = bestMatch(row.title, row.author, loose)
  if (fallback) return metadataFromDoc(fallback)

  // 3. The title alone, checking the surname loosely: survives a misspelled
  //    first name ("Octavio E. Butler") that sinks an author search.
  const byTitle = asCandidates(await searchDocs({ title }, 12))
  const lastTry = bestMatch(row.title, row.author, byTitle) ?? exactPopular(row.title, byTitle)
  return lastTry ? metadataFromDoc(lastTry) : null
}

export const openLibrary: BookSourceClient = {
  async search(query, signal) {
    const docs = await searchDocs(query, 16, signal)
    return docs.filter((doc) => doc.key?.startsWith('/works/')).map(toSearchResult)
  },

  async lookup(sourceId) {
    if (!/^OL\d+W$/.test(sourceId)) return null
    const [docs, work] = await Promise.all([
      searchDocs(`key:/works/${sourceId}`, 1),
      fetch(`${BASE}/works/${sourceId}.json`, { headers: HEADERS }).then((response) =>
        response.ok ? (response.json() as Promise<Record<string, unknown>>) : null,
      ),
    ])
    const doc = docs[0]
    if (!doc) return null
    const workSubjects = Array.isArray(work?.subjects) ? (work.subjects as string[]) : []
    const metadata: BookMetadata = {
      source: 'openlibrary',
      sourceId,
      title: doc.title,
      subtitle: doc.subtitle ?? null,
      authors: doc.author_name?.slice(0, 5) ?? [],
      publishedYear: doc.first_publish_year ?? null,
      pageCount: doc.number_of_pages_median ?? null,
      description: cleanOpenLibraryDescription(work?.description),
      genres: normalizeGenres([...(doc.subject ?? []), ...workSubjects]),
      coverUrl: coverIdFor(doc) ? coverById(coverIdFor(doc)!, 'L') : null,
      isbn13: isbn13From(doc.isbn),
    }
    return metadata
  },
}
