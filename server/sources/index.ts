import type { BookSource, SearchResult } from '../../shared/types'
import type { Env } from '../env'
import { fixtures } from './fixtures'
import { googleBooks } from './google'
import { openLibrary } from './openlibrary'
import type { BookMetadata, BookSourceClient } from './types'

/** Normalised for de-duplication: "The Hobbit; or, There and Back Again" ~ "the hobbit". */
const titleKey = (result: SearchResult) =>
  `${result.title
    .toLowerCase()
    .split(/[:;(]/)[0]!
    .replace(/[^a-z0-9]/g, '')}|${(result.authors[0] ?? '').toLowerCase().replace(/[^a-z]/g, '')}`

export function dedupe(results: SearchResult[]): SearchResult[] {
  const seen = new Map<string, SearchResult>()
  for (const result of results) {
    const key = titleKey(result)
    const existing = seen.get(key)
    // Prefer the edition that actually has a cover.
    if (!existing || (!existing.thumbnailUrl && result.thumbnailUrl)) seen.set(key, result)
  }
  return [...seen.values()]
}

function clientFor(env: Env, source: BookSource): BookSourceClient | null {
  if (source === 'fixture') return env.BOOK_SOURCE === 'fixture' ? fixtures : null
  if (source === 'google')
    return env.GOOGLE_BOOKS_API_KEY ? googleBooks(env.GOOGLE_BOOKS_API_KEY) : null
  return openLibrary
}

/**
 * Google Books when a key is configured (its search ranking is better), Open
 * Library otherwise or whenever Google is unavailable.
 */
export async function searchBooks(env: Env, query: string, signal?: AbortSignal) {
  if (env.BOOK_SOURCE === 'fixture') return fixtures.search(query, signal)
  if (env.GOOGLE_BOOKS_API_KEY) {
    try {
      const results = await googleBooks(env.GOOGLE_BOOKS_API_KEY).search(query, signal)
      if (results.length > 0) return dedupe(results)
    } catch (error) {
      console.warn('google books search failed, falling back to open library', error)
    }
  }
  return dedupe(await openLibrary.search(query, signal))
}

export async function lookupBook(
  env: Env,
  source: BookSource,
  sourceId: string,
): Promise<BookMetadata | null> {
  const client = clientFor(env, source)
  return client ? client.lookup(sourceId) : null
}
