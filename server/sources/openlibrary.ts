import type { SearchResult } from '../../shared/types'
import { normalizeGenres } from './genres'
import { cleanOpenLibraryDescription, isbn13From } from './text'
import { SourceError, type BookMetadata, type BookSourceClient } from './types'

const BASE = 'https://openlibrary.org'
const FIELDS =
  'key,title,subtitle,author_name,first_publish_year,cover_i,number_of_pages_median,subject,isbn,editions,editions.cover_i,editions.language'
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
  /** With lang=en, the edition that best matches the query, English first. */
  editions?: { docs?: { cover_i?: number; language?: string[] }[] }
}

/** The English edition's cover when there is one; the work's chosen cover otherwise. */
export function coverIdFor(doc: SearchDoc): number | null {
  const edition = doc.editions?.docs?.[0]
  if (edition?.cover_i && (!edition.language || edition.language.includes('eng'))) return edition.cover_i
  return doc.cover_i ?? null
}

export const coverById = (id: number, size: 'M' | 'L') =>
  `https://covers.openlibrary.org/b/id/${id}-${size}.jpg?default=false`

/** "/works/OL123W" -> "OL123W" */
const workId = (key: string) => key.replace('/works/', '')

async function searchDocs(query: string, limit: number, signal?: AbortSignal) {
  const url = `${BASE}/search.json?q=${encodeURIComponent(query)}&fields=${FIELDS}&limit=${limit}&lang=en`
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
