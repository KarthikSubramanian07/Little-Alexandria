import { describe, expect, it } from 'vitest'
import { datesForShelf, localToday } from './shelf-rules'

const base = { shelf: 'want_to_read' as const, startedAt: null, finishedAt: null }

describe('datesForShelf', () => {
  it('stamps the start date when you begin a book', () => {
    expect(datesForShelf(base, 'reading', '2026-11-13')).toEqual({
      startedAt: '2026-11-13',
      finishedAt: null,
    })
  })
  it('stamps the finish date and keeps the start when you finish', () => {
    const reading = { shelf: 'reading' as const, startedAt: '2026-10-01', finishedAt: null }
    expect(datesForShelf(reading, 'read', '2026-11-13')).toEqual({
      startedAt: '2026-10-01',
      finishedAt: '2026-11-13',
    })
  })
  it('never overwrites a date the reader chose', () => {
    const read = { shelf: 'read' as const, startedAt: '2026-01-01', finishedAt: '2026-02-01' }
    expect(datesForShelf({ ...read, shelf: 'reading' }, 'read', '2026-11-13').finishedAt).toBe(
      '2026-02-01',
    )
  })
  it('clears dates when a book goes back to the wishlist', () => {
    const read = { shelf: 'read' as const, startedAt: '2026-01-01', finishedAt: '2026-02-01' }
    expect(datesForShelf(read, 'want_to_read', '2026-11-13')).toEqual({
      startedAt: null,
      finishedAt: null,
    })
  })
  it('is a no-op for the same shelf', () => {
    const reading = { shelf: 'reading' as const, startedAt: '2026-10-01', finishedAt: null }
    expect(datesForShelf(reading, 'reading', '2026-11-13')).toEqual({
      startedAt: '2026-10-01',
      finishedAt: null,
    })
  })
})

describe('localToday', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(localToday(new Date(2026, 10, 13, 23, 30))).toBe('2026-11-13')
  })
})
