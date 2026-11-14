import { describe, expect, it } from 'vitest'
import type { Book } from '../shared/types'
import { aboutFrom, clip, fixtureAbout, withoutCredits, type AboutSources } from './about'

const book = (extra: Partial<Book> = {}): Book => ({
  id: 'openlibrary:OL17370186W',
  source: 'openlibrary',
  sourceId: 'OL17370186W',
  title: 'A Little Life',
  subtitle: null,
  authors: ['Hanya Yanagihara'],
  publishedYear: 2015,
  pageCount: 720,
  description: 'Already described.',
  genres: ['Literary Fiction'],
  coverUrl: null,
  isbn13: null,
  spineColor: null,
  ...extra,
})

// Trimmed from Open Library's real answers for A Little Life.
const sources = (extra: Partial<AboutSources> = {}): AboutSources => ({
  workId: 'OL17370186W',
  doc: {
    author_key: ['OL9325164A'],
    number_of_pages_median: 784,
    edition_count: 38,
    language: ['eng', 'spa', 'ita'],
    ratings_average: 3.9635,
    ratings_count: 137,
    want_to_read_count: 4344,
    currently_reading_count: 299,
    already_read_count: 169,
  },
  work: {
    description: { type: '/type/text', value: 'A 2015 novel by Hanya Yanagihara.' },
    excerpts: [
      { excerpt: 'Some later passage that is not the first.', comment: 'from chapter 3' },
      {
        excerpt:
          'The eleventh apartment had only one closet, but it did have a sliding glass door that opened onto a small balcony.',
        comment: 'first sentence',
      },
    ],
    subject_places: ['New York City', 'Lispenard Street', 'New York City', 'SoHo'],
    subject_times: ['1980s'],
    subject_people: ['Jude (Fictitious character)', 'Willem', 'JB'],
    subjects: [
      'Fiction',
      'LGBTQ novels',
      'Coming of Age',
      'Literary',
      'Friendship',
      'Amerikanisches Englisch',
      'Science Fiction',
      'Willem',
      'Grief',
      'nyt:combined-print-and-e-book-fiction=2015-04-05',
    ],
    links: [
      {
        title: 'The Subversive Brilliance of “A Little Life” - The New Yorker',
        url: 'https://www.newyorker.com/x',
      },
      { title: 'Official Instagram page', url: 'https://www.instagram.com/alittlelifebook/' },
      { title: 'Another New Yorker piece', url: 'https://www.newyorker.com/y' },
      { title: 'An insecure page', url: 'http://example.org/review' },
      { title: 'A Little Life - Wikipedia', url: 'https://en.wikipedia.org/wiki/A_Little_Life' },
    ],
  },
  author: {
    key: '/authors/OL9325164A',
    name: 'Hanya Yanagihara',
    bio: 'Hanya Yanagihara (born 1974)[3] is an **American** novelist.',
    birth_date: '20 September 1974',
    photos: [-1, 11463283],
  },
  authorWiki: null,
  bookWiki: null,
  ...extra,
})

describe('aboutFrom', () => {
  it('summarises what readers think, and how long the book takes', () => {
    const about = aboutFrom(book(), sources())
    expect(about.community).toEqual({
      rating: 4,
      ratings: 137,
      wantToRead: 4344,
      reading: 299,
      read: 169,
    })
    expect(about.readingMinutes).toBe(864)
    expect(about.editions).toBe(38)
    expect(about.languages).toBe(3)
    expect(about.openLibraryUrl).toBe('https://openlibrary.org/works/OL17370186W')
  })

  it('hides an average built on only a handful of ratings', () => {
    const thin = sources({ doc: { ratings_average: 5, ratings_count: 2, want_to_read_count: 9 } })
    expect(aboutFrom(book(), thin).community?.rating).toBeNull()
    expect(aboutFrom(book(), sources({ doc: {} })).community).toBeNull()
  })

  it('opens with the first sentence, not just any excerpt', () => {
    expect(aboutFrom(book(), sources()).opening).toMatch(/^The eleventh apartment/)
  })

  it('names the story’s places, times, and people, and keeps themes specific', () => {
    const { story } = aboutFrom(book(), sources())
    expect(story.places).toEqual(['New York City', 'Lispenard Street', 'SoHo'])
    expect(story.times).toEqual(['1980s'])
    expect(story.characters).toEqual(['Jude', 'Willem', 'JB'])
    // No genres, no characters, no other languages, no list tags.
    expect(story.themes).toEqual(['Coming of Age', 'Friendship', 'Grief'])
  })

  it('keeps reviews and reference pages, one per site, https only, no social media', () => {
    expect(aboutFrom(book(), sources()).links).toEqual([
      {
        title: 'The Subversive Brilliance of “A Little Life” - The New Yorker',
        url: 'https://www.newyorker.com/x',
      },
      { title: 'A Little Life - Wikipedia', url: 'https://en.wikipedia.org/wiki/A_Little_Life' },
    ])
  })

  it('introduces the author, crediting where the biography came from', () => {
    const { author } = aboutFrom(book(), sources())
    expect(author).toEqual({
      name: 'Hanya Yanagihara',
      bio: 'Hanya Yanagihara (born 1974) is an American novelist.',
      bioSource: { name: 'Open Library', url: 'https://openlibrary.org/authors/OL9325164A' },
      born: '20 September 1974',
      died: null,
      photoUrl: `/api/cover?src=${encodeURIComponent('https://covers.openlibrary.org/a/id/11463283-M.jpg?default=false')}`,
    })
  })

  it('falls back to Wikipedia for a writer, and never for someone else of the same name', () => {
    const wiki = (description: string) =>
      sources({
        author: null,
        authorWiki: {
          type: 'standard',
          description,
          extract: 'Hanya Yanagihara is someone.',
          content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Hanya_Yanagihara' } },
        },
      })
    expect(aboutFrom(book(), wiki('American novelist')).author?.bioSource?.name).toBe('Wikipedia')
    expect(aboutFrom(book(), wiki('Footballer')).author).toBeNull()
  })

  it('offers a description only when the book has none', () => {
    expect(aboutFrom(book(), sources()).description).toBeNull()
    expect(aboutFrom(book({ description: null }), sources()).description).toBe(
      'A 2015 novel by Hanya Yanagihara.',
    )
  })

  it('copes with nothing at all', () => {
    const about = aboutFrom(book({ pageCount: null }), {
      workId: null,
      doc: null,
      work: null,
      author: null,
      authorWiki: null,
      bookWiki: null,
    })
    expect(about).toMatchObject({
      opening: null,
      readingMinutes: null,
      community: null,
      author: null,
      links: [],
      openLibraryUrl: null,
      story: { places: [], times: [], characters: [], themes: [] },
    })
  })

  it('gives the offline catalogue a full, clearly sample card', () => {
    const about = fixtureAbout(book())
    expect(about.community?.wantToRead).toBe(3120)
    expect(about.opening).toMatch(/^Sample opening lines/)
    expect(about.author?.bio).toMatch(/^Sample biography/)
  })
})

describe('clip', () => {
  it('ends at a sentence when it can, at a word when it must', () => {
    expect(clip('Short.', 50)).toBe('Short.')
    expect(clip('One sentence here. Another that runs on and on and on.', 30)).toBe(
      'One sentence here.',
    )
    expect(clip('averyveryverylongword andanother andmore', 25)).toBe('averyveryverylongword…')
  })
})

describe('withoutCredits', () => {
  it('drops photo credits and links copied in with a biography', () => {
    expect(
      withoutCredits(
        'She is an American novelist. She grew up in Hawaii. Photo by SamLevyPhoto2020 - Own work, CC BY-SA 4.0, https://commons.wikimedia.org/w/index.php?curid=93126610',
      ),
    ).toBe('She is an American novelist. She grew up in Hawaii.')
  })
})
