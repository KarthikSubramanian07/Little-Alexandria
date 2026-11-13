import { describe, expect, it } from 'vitest'
import type { LibraryEntry, Shelf } from '../shared/types'
import {
  LibraryError,
  applyPatch,
  bookFromMetadata,
  comparePositions,
  computeStats,
  frontOf,
  proxiedCover,
} from './library'
import { FIXTURE_BOOKS } from './sources/fixtures-data'

const entry = (index: number, shelf: Shelf, extra: Partial<LibraryEntry> = {}): LibraryEntry => ({
  id: `e${index}`,
  shelf,
  position: 'a0',
  rating: null,
  notes: null,
  startedAt: null,
  finishedAt: null,
  finishedApprox: false,
  createdAt: 0,
  updatedAt: 0,
  book: bookFromMetadata(FIXTURE_BOOKS[index]!),
  ...extra,
})

describe('positions', () => {
  it('puts new books in front of the current first book', () => {
    const first = frontOf(null)
    const before = frontOf(first)
    expect(comparePositions(before, first)).toBe(-1)
  })
  it('compares bytewise, not by locale', () => {
    // Uppercase sorts before lowercase in byte order; localeCompare disagrees.
    expect(comparePositions('Zz', 'a0')).toBe(-1)
  })
})

describe('applyPatch', () => {
  const front = () => 'Zz'

  it('moves a book to the front of its new shelf when no position is given', () => {
    const next = applyPatch(entry(0, 'reading'), { shelf: 'read' }, front, 5)
    expect(next).toMatchObject({ shelf: 'read', position: 'Zz', updatedAt: 5 })
  })

  it('keeps an explicit position from a drag', () => {
    expect(
      applyPatch(entry(0, 'reading'), { shelf: 'read', position: 'a5' }, front, 5).position,
    ).toBe('a5')
  })

  it('rejects a finish date before the start date', () => {
    const reading = entry(0, 'reading', { startedAt: '2026-05-10' })
    expect(() => applyPatch(reading, { finishedAt: '2026-05-01' }, front, 1)).toThrow(LibraryError)
  })

  it('treats blank notes as no notes', () => {
    expect(applyPatch(entry(0, 'read'), { notes: '   ' }, front, 1).notes).toBeNull()
  })

  it('clears the year-only flag when a reader sets the finish date', () => {
    const approx = entry(0, 'read', { finishedAt: '2025-12-31', finishedApprox: true })
    expect(applyPatch(approx, { finishedAt: '2025-06-01' }, front, 1).finishedApprox).toBe(false)
    expect(applyPatch(approx, { rating: 4 }, front, 1).finishedApprox).toBe(true)
  })

  it('leaves untouched fields alone', () => {
    const rated = entry(0, 'read', { rating: 4, notes: 'Loved it' })
    expect(applyPatch(rated, { rating: 5 }, front, 1)).toMatchObject({
      rating: 5,
      notes: 'Loved it',
    })
  })
})

describe('computeStats', () => {
  it('counts only books finished in the year, and weights loved genres', () => {
    const entries = [
      entry(0, 'read', { finishedAt: '2026-03-02', rating: 5 }), // Piranesi, Fantasy, 272p
      entry(7, 'read', { finishedAt: '2026-05-20', rating: 3 }), // Dune, SF, 608p
      entry(2, 'read', { finishedAt: '2025-12-30' }), // Earthsea, last year
      entry(3, 'reading', { startedAt: '2026-11-01' }),
    ]
    const stats = computeStats(entries, { '2026': 24 }, 2026)
    expect(stats).toMatchObject({
      year: 2026,
      booksRead: 2,
      pagesRead: 272 + 608,
      goal: 24,
      averageRating: 4,
      currentlyReading: 1,
      libraryTotal: 4,
    })
    expect(stats.byMonth[2]).toBe(1)
    expect(stats.byMonth[4]).toBe(1)
    expect(stats.topGenres[0]).toEqual({ genre: 'Fantasy', count: 3 })
  })

  it('counts year-only finishes in the total but not in a month', () => {
    const stats = computeStats(
      [entry(0, 'read', { finishedAt: '2025-12-31', finishedApprox: true })],
      {},
      2025,
    )
    expect(stats.booksRead).toBe(1)
    expect(stats.byMonth.every((count) => count === 0)).toBe(true)
  })

  it('has sensible empty values', () => {
    expect(computeStats([], {}, 2026)).toMatchObject({
      booksRead: 0,
      pagesRead: 0,
      goal: null,
      averageRating: null,
      topGenres: [],
    })
  })
})

describe('proxiedCover', () => {
  it('routes allowed hosts through our origin and refuses the rest', () => {
    expect(proxiedCover('https://covers.openlibrary.org/b/id/1-L.jpg')).toBe(
      '/api/cover?src=https%3A%2F%2Fcovers.openlibrary.org%2Fb%2Fid%2F1-L.jpg',
    )
    expect(proxiedCover('https://evil.example/cover.jpg')).toBeNull()
    expect(proxiedCover('http://covers.openlibrary.org/b/id/1-L.jpg')).toBeNull()
    expect(proxiedCover('not a url')).toBeNull()
    expect(proxiedCover(null)).toBeNull()
  })
})
