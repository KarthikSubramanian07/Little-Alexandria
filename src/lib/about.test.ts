import { describe, expect, it } from 'vitest'
import type { BookAbout } from '../../shared/types'
import { aboutFacts, readingTime } from './about'

describe('readingTime', () => {
  it('speaks in minutes for short books and hours for the rest', () => {
    expect(readingTime(12)).toBe('about 10 minutes')
    expect(readingTime(2)).toBe('about 5 minutes')
    expect(readingTime(70)).toBe('about 1 hour')
    expect(readingTime(864)).toBe('about 14 hours')
  })
})

describe('aboutFacts', () => {
  const about = (extra: Partial<BookAbout>): BookAbout => ({
    description: null,
    opening: null,
    readingMinutes: null,
    community: null,
    story: { places: [], times: [], characters: [], themes: [] },
    author: null,
    links: [],
    editions: null,
    languages: null,
    openLibraryUrl: null,
    ...extra,
  })

  it('adds reading time and editions when there are any', () => {
    expect(aboutFacts(about({ readingMinutes: 864, editions: 38, languages: 10 }))).toEqual([
      { label: 'Reading time', value: 'about 14 hours' },
      { label: 'Editions', value: '38 in 10 languages' },
    ])
  })

  it('says nothing about a single edition, or before the answer arrives', () => {
    expect(aboutFacts(about({ editions: 1, languages: 1 }))).toEqual([])
    expect(aboutFacts(undefined)).toEqual([])
  })
})
