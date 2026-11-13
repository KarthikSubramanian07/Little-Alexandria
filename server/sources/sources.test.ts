import { describe, expect, it } from 'vitest'
import { normalizeGenres } from './genres'
import { cleanThumbnail, largeCover } from './google'
import { dedupe } from './index'
import { coverIdFor } from './openlibrary'
import { cleanOpenLibraryDescription, isbn13From, plainText, yearFrom } from './text'

describe('normalizeGenres', () => {
  it('folds noisy subjects into friendly genres', () => {
    expect(
      normalizeGenres(['form:novel', 'genre:fantasy', 'nyt:combined-print=2020', 'Fiction']),
    ).toEqual(['Fantasy'])
    expect(normalizeGenres(['Fiction, science fiction, general', 'Space travel'])).toEqual([
      'Science Fiction',
    ])
  })
  it('keeps Literary Fiction only as a fallback', () => {
    expect(normalizeGenres(['Fiction', 'English literature'])).toEqual(['Literary Fiction'])
  })
  it('caps the list', () => {
    expect(normalizeGenres(['fantasy', 'mystery', 'romance', 'poetry', 'history'], 2)).toHaveLength(
      2,
    )
  })
})

describe('text helpers', () => {
  it('strips html and entities', () => {
    expect(plainText('<p>Tom &amp; Jerry</p><br>Next')).toBe('Tom & Jerry\n\nNext')
    expect(plainText('   ')).toBeNull()
  })
  it('cleans open library descriptions', () => {
    const raw = { value: 'A tale of [wonder][1].\n----------\nAlso contained:\n[1]: https://x' }
    expect(cleanOpenLibraryDescription(raw)).toBe('A tale of wonder.')
    expect(cleanOpenLibraryDescription(42)).toBeNull()
  })
  it('extracts years and isbn-13s', () => {
    expect(yearFrom('2004-03-01')).toBe(2004)
    expect(yearFrom(undefined)).toBeNull()
    expect(isbn13From(['1526622416', '9781526622426'])).toBe('9781526622426')
  })
})

describe('google covers', () => {
  it('upgrades to https and removes the fake page curl', () => {
    expect(
      cleanThumbnail('http://books.google.com/books/content?id=x&zoom=1&edge=curl&source=gbs_api'),
    ).toBe('https://books.google.com/books/content?id=x&zoom=1&source=gbs_api')
    expect(largeCover('abc123')).toContain('fife=w600-h900')
  })
})

describe('dedupe', () => {
  const result = (title: string, author: string, thumbnailUrl: string | null) => ({
    source: 'openlibrary' as const,
    sourceId: title,
    title,
    authors: [author],
    publishedYear: null,
    pageCount: null,
    thumbnailUrl,
  })
  it('merges editions of the same book, preferring the one with a cover', () => {
    const merged = dedupe([
      result('The Hobbit', 'J.R.R. Tolkien', null),
      result('The Hobbit: or There and Back Again', 'J. R. R. Tolkien', 'cover.jpg'),
      result('Dune', 'Frank Herbert', null),
    ])
    expect(merged).toHaveLength(2)
    expect(merged[0]!.thumbnailUrl).toBe('cover.jpg')
  })
})

describe('coverIdFor', () => {
  const doc = { key: '/works/OL1W', title: 'X', cover_i: 1 }
  it('prefers the English edition cover', () => {
    expect(coverIdFor({ ...doc, editions: { docs: [{ cover_i: 2, language: ['eng'] }] } })).toBe(2)
  })
  it('falls back to the work cover for other languages or no edition', () => {
    expect(coverIdFor({ ...doc, editions: { docs: [{ cover_i: 2, language: ['spa'] }] } })).toBe(1)
    expect(coverIdFor(doc)).toBe(1)
    expect(coverIdFor({ key: '/works/OL1W', title: 'X' })).toBeNull()
  })
})
