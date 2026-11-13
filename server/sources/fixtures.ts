import type { SearchResult } from '../../shared/types'
import { FIXTURE_BOOKS } from './fixtures-data'
import type { BookSourceClient } from './types'

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const fixtures: BookSourceClient = {
  async search(query) {
    const terms = fold(query).split(/\s+/).filter(Boolean)
    return FIXTURE_BOOKS.filter((book) => {
      const haystack = fold(`${book.title} ${book.authors.join(' ')}`)
      return terms.every((term) => haystack.includes(term))
    }).map((book): SearchResult => ({
      source: 'fixture',
      sourceId: book.sourceId,
      title: book.title,
      authors: book.authors,
      publishedYear: book.publishedYear,
      pageCount: book.pageCount,
      thumbnailUrl: book.coverUrl?.replace('-L.jpg', '-M.jpg') ?? null,
    }))
  },
  async lookup(sourceId) {
    return FIXTURE_BOOKS.find((book) => book.sourceId === sourceId) ?? null
  },
}
