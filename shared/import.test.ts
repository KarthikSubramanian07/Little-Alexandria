import { describe, expect, it } from 'vitest'
import { hintsFromFileName, mergeRows, parseCsv, parseReadingList, toIsoDate } from './import'

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, CRLF, and stray whitespace', () => {
    const text = 'Title,Author\r\n"Hello, World","Jane ""JJ"" Doe"\r\nW;t,"Margaret Edson"\t\n'
    expect(parseCsv(text)).toEqual([
      ['Title', 'Author'],
      ['Hello, World', 'Jane "JJ" Doe'],
      ['W;t', 'Margaret Edson'],
    ])
  })
  it('drops blank lines and a byte-order mark', () => {
    expect(parseCsv('﻿a,b\n\n,\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })
})

describe('toIsoDate', () => {
  it('accepts Goodreads and ISO dates and rejects nonsense', () => {
    expect(toIsoDate('2023/5/9')).toBe('2023-05-09')
    expect(toIsoDate('2023-02-30')).toBeNull()
    expect(toIsoDate('')).toBeNull()
  })
})

describe('hintsFromFileName', () => {
  it('reads shelves and genres from list names', () => {
    expect(hintsFromFileName('Books List - Read.csv')).toEqual({ shelf: 'read', genre: null })
    expect(hintsFromFileName('Books List - Sci-Fi.csv')).toEqual({
      shelf: 'want_to_read',
      genre: 'Science Fiction',
    })
    expect(hintsFromFileName('My TBR.csv').shelf).toBe('want_to_read')
    expect(hintsFromFileName('Currently reading.csv').shelf).toBe('reading')
  })
})

describe('parseReadingList', () => {
  it('reads plain lists, carrying a blank author down from the row above', () => {
    const text = 'The Shining,Stephen King\nDoctor Sleep,\nMisery,\nDune,Frank Herbert\n'
    const { format, rows } = parseReadingList(text, 'Books List - Thriller.csv')
    expect(format).toBe('simple')
    expect(rows.map((row) => [row.title, row.author])).toEqual([
      ['The Shining', 'Stephen King'],
      ['Doctor Sleep', 'Stephen King'],
      ['Misery', 'Stephen King'],
      ['Dune', 'Frank Herbert'],
    ])
    expect(rows.every((row) => row.shelf === 'want_to_read' && row.genreHint === 'Thriller')).toBe(
      true,
    )
  })

  it('puts a book with a year on the Read shelf, knowing only the year', () => {
    const { rows } = parseReadingList('Macbeth,William Shakespeare,2025\n', 'Books List - Read.csv')
    expect(rows[0]).toMatchObject({ shelf: 'read', finishedYear: 2025, finishedAt: null })
  })

  it('reads a Goodreads export', () => {
    const text = [
      'Book Id,Title,Author,ISBN,ISBN13,My Rating,Date Read,Exclusive Shelf,My Review',
      '1,Piranesi,Susanna Clarke,"=""1526622424""","=""9781526622426""",5,2024/03/02,read,Loved the House',
      '2,Dune,Frank Herbert,,,0,,to-read,',
      '3,Circe,Madeline Miller,,,0,,currently-reading,',
    ].join('\n')
    const { format, rows } = parseReadingList(text)
    expect(format).toBe('goodreads')
    expect(rows[0]).toMatchObject({
      title: 'Piranesi',
      isbn: '9781526622426',
      rating: 5,
      shelf: 'read',
      finishedAt: '2024-03-02',
      notes: 'Loved the House',
    })
    expect(rows[1]).toMatchObject({ shelf: 'want_to_read', rating: null })
    expect(rows[2]!.shelf).toBe('reading')
  })

  it('reads a StoryGraph export', () => {
    const text = [
      'Title,Authors,ISBN/UID,Read Status,Star Rating,Last Date Read,Review',
      'Circe,"Madeline Miller, Someone Else",9780316556347,read,4.5,2023/08/01,',
    ].join('\n')
    const { format, rows } = parseReadingList(text)
    expect(format).toBe('storygraph')
    expect(rows[0]).toMatchObject({
      author: 'Madeline Miller',
      rating: 5,
      shelf: 'read',
      finishedAt: '2023-08-01',
    })
  })
})

describe('mergeRows', () => {
  it('keeps one row per book, preferring the furthest-along shelf', () => {
    const want = parseReadingList('Dune,Frank Herbert\n', 'Books List - Sci-Fi.csv').rows
    const read = parseReadingList('Dune,Frank Herbert,2024\n', 'Books List - Read.csv').rows
    const merged = mergeRows([...want, ...read])
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      shelf: 'read',
      finishedYear: 2024,
      genreHint: 'Science Fiction',
    })
  })
})
