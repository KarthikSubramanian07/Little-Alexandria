import { describe, expect, it } from 'vitest'
import {
  authorMatches,
  bestMatch,
  exactPopular,
  normalizeTitle,
  splitAuthors,
  titleSimilarity,
} from './match'

describe('normalizeTitle', () => {
  it('drops subtitles, articles, punctuation, and accents', () => {
    expect(normalizeTitle('The Defining Decade: Why Your Twenties Matter')).toBe('defining decade')
    expect(normalizeTitle('Salem’s Lot')).toBe('salems lot')
    expect(normalizeTitle('Les Misérables')).toBe('les miserables')
  })
})

describe('titleSimilarity', () => {
  it('scores near-identical titles high and unrelated ones low', () => {
    expect(titleSimilarity('Nineteen Eighty-Four', 'Nineteen eighty-four')).toBe(1)
    expect(titleSimilarity('The Martian', 'Martian Chronicles')).toBeLessThan(0.7)
  })
})

describe('authorMatches', () => {
  it('compares surnames, ignoring initials and suffixes', () => {
    expect(authorMatches('J.R.R. Tolkien', ['J. R. R. Tolkien'])).toBe(true)
    expect(authorMatches('Martin Luther King Jr.', ['Martin Luther King'])).toBe(true)
    expect(authorMatches('Stephen King', ['Owen King'])).toBe(true)
    expect(authorMatches('Stephen King', ['Dean Koontz'])).toBe(false)
    expect(authorMatches(null, ['Anyone'])).toBe(true)
  })
  it('forgives one typo in a long surname and reads co-authors', () => {
    expect(authorMatches('Michael Chabo', ['Michael Chabon'])).toBe(true)
    expect(authorMatches('Peal S. Buck', ['Pearl S. Buck'])).toBe(true)
    expect(authorMatches('Friedrich Engels & Karl Marx', ['Karl Marx'])).toBe(true)
    expect(authorMatches('Paulo Coelho', ['Paulo Coelho (Author)'])).toBe(true)
    expect(authorMatches('Ann Lee', ['Ann Lea'])).toBe(false)
  })
})

describe('bestMatch', () => {
  const candidates = [
    { title: 'SparkNotes: The Shining', authors: ['SparkNotes'] },
    { title: 'The Shining', authors: ['Stephen King'] },
    { title: 'Shining Light', authors: ['Someone'] },
  ]
  it('prefers the book by the right author over a study guide', () => {
    expect(bestMatch('The Shining', 'Stephen King', candidates)?.authors).toEqual(['Stephen King'])
  })
  it('refuses weak matches', () => {
    expect(bestMatch('The Stand', 'Stephen King', candidates)).toBeNull()
  })
  it('prefers the exact title and the popular edition over omnibuses and guides', () => {
    const alchemists = [
      {
        title: 'The Alchemist - The Pilgrimage - By the River Piedra',
        authors: ['Paulo Coelho'],
        editionCount: 1,
      },
      { title: 'The Alchemist', authors: ['Paulo Coelho'], editionCount: 300 },
      { title: 'Sparknotes The Alchemist', authors: ['Paulo Coelho'], editionCount: 1 },
    ]
    expect(bestMatch('The Alchemist', 'Paulo Coelho', alchemists)?.editionCount).toBe(300)
  })
  it('trusts the catalogue’s author filter for names in other scripts', () => {
    const tolstoy = [{ title: 'War and Peace', authors: ['Лев Толстой'] }]
    expect(bestMatch('War and Peace', 'Leo Tolstoy', tolstoy)).toBeNull()
    expect(bestMatch('War and Peace', 'Leo Tolstoy', tolstoy, { trustAuthor: true })).not.toBeNull()
  })
  it('survives a typo in the title when the author agrees', () => {
    const kingsolver = [{ title: 'Demon Copperhead', authors: ['Barbara Kingsolver'] }]
    expect(bestMatch('Demon Copperfield', 'Barbara Kingsolver', kingsolver)).not.toBeNull()
  })
  it('needs a near-exact title when the author is unknown', () => {
    expect(bestMatch('The Shining', null, candidates)?.title).toBe('The Shining')
  })
})

describe('splitAuthors', () => {
  it('drops parentheticals and splits co-authors', () => {
    expect(splitAuthors('James S. A. Corey (Daniel Abraham & Ty Franck)')).toEqual([
      'James S. A. Corey',
    ])
    expect(splitAuthors('Chriss Voss & Tahl Raz')).toEqual(['Chriss Voss', 'Tahl Raz'])
    expect(splitAuthors(null)).toEqual([])
  })
})

describe('exactPopular', () => {
  it('trusts an exact, widely published title over a wrong author', () => {
    const candidates = [
      { title: 'Murder on the Orient Express', authors: ['Agatha Christie'], editionCount: 240 },
      { title: 'Murder on the Orient Express (Study Guide)', authors: ['Notes'], editionCount: 2 },
    ]
    expect(exactPopular('Murder on the Orient Express', candidates)?.authors).toEqual([
      'Agatha Christie',
    ])
    expect(
      exactPopular('Murder on the Orient Express', [{ ...candidates[0]!, editionCount: 2 }]),
    ).toBeNull()
  })
})
