import { describe, expect, it } from 'vitest'
import { libraryToCsv } from './export'
import type { LibraryEntry } from './types'

const entry = (title: string, notes: string | null = null) =>
  ({
    id: 'e1',
    shelf: 'read',
    position: 'a0',
    rating: 4,
    notes,
    startedAt: null,
    finishedAt: '2026-03-19',
    book: {
      id: 'fixture:1',
      source: 'fixture',
      sourceId: '1',
      title,
      subtitle: null,
      authors: ['Someone'],
      publishedYear: 2020,
      pageCount: 300,
      description: null,
      genres: ['Fantasy'],
      coverUrl: null,
      isbn13: null,
      spineColor: null,
    },
  }) as unknown as LibraryEntry

describe('libraryToCsv', () => {
  it('keeps text that looks like a formula as text', () => {
    const csv = libraryToCsv([entry('=HYPERLINK("https://evil.example","x")', '@SUM(A1)')])
    const row = csv.split('\n')[1]!
    expect(row.startsWith(`"'=HYPERLINK(""https://evil.example"",""x"")"`)).toBe(true)
    expect(row).toContain(`'@SUM(A1)`)
    for (const lead of ['+', '-', '\t']) {
      expect(libraryToCsv([entry(`${lead}1`)]).split('\n')[1]).toMatch(/^"?'/)
    }
  })

  it('leaves ordinary titles and numbers alone', () => {
    const row = libraryToCsv([entry('Piranesi')]).split('\n')[1]!
    expect(row.startsWith('Piranesi,Someone,')).toBe(true)
    expect(row).toContain(',4,')
    expect(row).toContain('2026/03/19')
  })
})
