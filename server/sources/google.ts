import type { SearchResult } from '../../shared/types'
import { normalizeGenres } from './genres'
import { plainText, yearFrom } from './text'
import { SourceError, type BookMetadata, type BookSourceClient } from './types'

const BASE = 'https://www.googleapis.com/books/v1/volumes'

interface Volume {
  id: string
  volumeInfo: {
    title?: string
    subtitle?: string
    authors?: string[]
    publishedDate?: string
    pageCount?: number
    description?: string
    categories?: string[]
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    industryIdentifiers?: { type: string; identifier: string }[]
  }
}

/** Google serves http thumbnails with a fake page-curl; fix both. */
export function cleanThumbnail(url: string | undefined): string | null {
  if (!url) return null
  return url.replace(/^http:/, 'https:').replace(/&edge=curl/g, '')
}

/** A fixed-size cover that is far sharper than the API's thumbnail. */
export const largeCover = (id: string) =>
  `https://books.google.com/books/publisher/content/images/frontcover/${id}?fife=w600-h900&source=gbs_api`

function toSearchResult(volume: Volume): SearchResult | null {
  const info = volume.volumeInfo
  if (!info.title) return null
  return {
    source: 'google',
    sourceId: volume.id,
    title: info.title,
    authors: info.authors?.slice(0, 3) ?? [],
    publishedYear: yearFrom(info.publishedDate),
    pageCount: info.pageCount ?? null,
    thumbnailUrl: cleanThumbnail(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail),
  }
}

export function googleBooks(apiKey: string): BookSourceClient {
  return {
    async search(query, signal) {
      const url = `${BASE}?q=${encodeURIComponent(query)}&maxResults=16&printType=books&key=${apiKey}`
      const response = await fetch(url, { signal })
      if (!response.ok) throw new SourceError('Google Books search failed', response.status)
      const body = (await response.json()) as { items?: Volume[] }
      return (body.items ?? []).map(toSearchResult).filter((result) => result !== null)
    },

    async lookup(sourceId) {
      if (!/^[\w-]{6,20}$/.test(sourceId)) return null
      const response = await fetch(`${BASE}/${sourceId}?key=${apiKey}`)
      if (response.status === 404) return null
      if (!response.ok) throw new SourceError('Google Books lookup failed', response.status)
      const volume = (await response.json()) as Volume
      const info = volume.volumeInfo
      if (!info.title) return null
      const metadata: BookMetadata = {
        source: 'google',
        sourceId,
        title: info.title,
        subtitle: info.subtitle ?? null,
        authors: info.authors?.slice(0, 5) ?? [],
        publishedYear: yearFrom(info.publishedDate),
        pageCount: info.pageCount && info.pageCount > 0 ? info.pageCount : null,
        description: plainText(info.description),
        // Google categories look like "Fiction / Fantasy / Epic"; split the path.
        genres: normalizeGenres(
          info.categories?.flatMap((category) => category.split(' / ')) ?? [],
        ),
        coverUrl: info.imageLinks ? largeCover(sourceId) : null,
        isbn13:
          info.industryIdentifiers?.find((identifier) => identifier.type === 'ISBN_13')
            ?.identifier ?? null,
      }
      return metadata
    },
  }
}
