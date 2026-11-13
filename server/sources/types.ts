import type { BookSource, SearchResult } from '../../shared/types'

/** Everything we store about a book, fetched by the server from its source. */
export interface BookMetadata {
  source: BookSource
  sourceId: string
  title: string
  subtitle: string | null
  authors: string[]
  publishedYear: number | null
  pageCount: number | null
  description: string | null
  genres: string[]
  coverUrl: string | null
  isbn13: string | null
}

export interface BookSourceClient {
  search(query: string, signal?: AbortSignal): Promise<SearchResult[]>
  lookup(sourceId: string): Promise<BookMetadata | null>
}

export class SourceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}
