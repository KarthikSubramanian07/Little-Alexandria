// "About this book": what the open catalogues know beyond the basic record.
// Open Library (CC0) supplies reading logs and ratings, the opening lines,
// the places, times, and people of the story, editions, the author's record,
// and links to reviews. Wikipedia (CC BY-SA, credited on the card) fills in an
// author biography or a description when Open Library has none.
//
// Fetching lives in aboutFor(); shaping lives in aboutFrom(), which is pure and
// tested against recorded responses. Every upstream call is cached at the edge
// for a week and given a deadline, and any one of them failing just leaves its
// part of the card empty.
import type { Book, BookAbout } from '../shared/types'
import { proxiedCover } from './library'
import { usefulSubjects } from './related'
import { KNOWN_GENRES } from './sources/genres'
import { matchOpenLibrary } from './sources/openlibrary'
import { cleanOpenLibraryDescription, plainText } from './sources/text'

const OL = 'https://openlibrary.org'
const WIKIPEDIA = 'https://en.wikipedia.org/api/rest_v1/page/summary/'
const HEADERS = { 'User-Agent': 'LittleAlexandria/1.0 (+https://little-alexandria.pages.dev)' }
const WEEK = 60 * 60 * 24 * 7
const FIELDS = [
  'key',
  'author_name',
  'author_key',
  'number_of_pages_median',
  'edition_count',
  'language',
  'ratings_average',
  'ratings_count',
  'want_to_read_count',
  'currently_reading_count',
  'already_read_count',
  'first_sentence',
  'subject',
  'place',
  'time',
  'person',
].join(',')

/** Minutes per page at an ordinary reading pace (about 250 words a page). */
const MINUTES_PER_PAGE = 1.2

interface AboutDoc {
  key?: string
  author_key?: string[]
  number_of_pages_median?: number
  edition_count?: number
  language?: string[]
  ratings_average?: number
  ratings_count?: number
  want_to_read_count?: number
  currently_reading_count?: number
  already_read_count?: number
  first_sentence?: string[]
  subject?: string[]
  place?: string[]
  time?: string[]
  person?: string[]
}

interface AboutWork {
  description?: unknown
  excerpts?: { excerpt?: string; comment?: string }[]
  links?: { title?: string; url?: string }[]
  subjects?: string[]
  subject_places?: string[]
  subject_times?: string[]
  subject_people?: string[]
}

interface AboutAuthor {
  key?: string
  name?: string
  bio?: unknown
  birth_date?: string
  death_date?: string
  photos?: number[]
  wikipedia?: string
  links?: { title?: string; url?: string }[]
}

interface WikiSummary {
  type?: string
  title?: string
  description?: string
  extract?: string
  content_urls?: { desktop?: { page?: string } }
}

export interface AboutSources {
  workId: string | null
  doc: AboutDoc | null
  work: AboutWork | null
  author: AboutAuthor | null
  authorWiki: WikiSummary | null
  bookWiki: WikiSummary | null
}

// ── Shaping ───────────────────────────────────────────────────────────────

const squash = (text: string) => text.replace(/\s+/g, ' ').trim()

/** Cut long text at a sentence end, or failing that a word, near `limit`. */
export function clip(text: string, limit: number): string {
  if (text.length <= limit) return text
  const head = text.slice(0, limit)
  const sentence = head.search(/[.!?]["”’)]?\s[^.!?]*$/)
  if (sentence > limit * 0.5) return head.slice(0, sentence + 1).trim()
  return `${head.slice(0, head.lastIndexOf(' ')).trim()}…`
}

/** Unique, readable, short labels, in their original order. */
function labels(values: readonly string[] | undefined, limit: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values ?? []) {
    const value = squash(raw.replace(/\s*\((fictitious|imaginary) (character|place)\)$/i, ''))
    const key = value.toLowerCase()
    if (!value || value.length > 40 || value.includes('--') || seen.has(key)) continue
    seen.add(key)
    out.push(value)
    if (out.length === limit) break
  }
  return out
}

/** Themes: specific subjects that aren't genres, places, or people, in English. */
function themesFrom(subjects: readonly string[], exclude: readonly string[]): string[] {
  const taken = new Set([...exclude, ...KNOWN_GENRES].map((value) => value.toLowerCase()))
  const candidates = usefulSubjects(subjects).filter(
    (subject) =>
      /^[A-Za-z][A-Za-z' &-]{2,31}$/.test(subject) &&
      !taken.has(subject.toLowerCase()) &&
      !/\b(novels?|fiction|stories|literature|literary|readers?|translations?|english|american|british|sagas?|general|dead|juvenile|open library|staff picks)\b/i.test(
        subject,
      ) &&
      // Open Library mixes in other languages' subject headings.
      !/(isch|ische|isches|ción|ção|roman$|romane|littérature|novela|deutsch)/i.test(subject),
  )
  return labels(
    candidates.map((subject) => subject.charAt(0).toUpperCase() + subject.slice(1)),
    6,
  )
}

/** The opening lines: an excerpt Open Library marks as the first sentence, or any excerpt. */
function openingFrom(work: AboutWork | null, doc: AboutDoc | null): string | null {
  const excerpts = (work?.excerpts ?? []).filter((item) => item.excerpt)
  const first = excerpts.find((item) => /first/i.test(item.comment ?? '')) ?? excerpts[0]
  const raw = first?.excerpt ?? doc?.first_sentence?.[0] ?? null
  const text = raw ? squash(plainText(raw) ?? '') : ''
  return text.length >= 20 ? clip(text, 420) : null
}

const SOCIAL = /(instagram|facebook|twitter|x\.com|tiktok|youtube|pinterest|amazon\.|shop)/i

/** Reviews and reference pages: https only, one per site, no shops or social media. */
function linksFrom(work: AboutWork | null, bookWikiUrl: string | null) {
  const hosts = new Set<string>()
  const out: { title: string; url: string }[] = []
  const add = (title: string | undefined, url: string | undefined) => {
    if (!title || !url || out.length >= 5) return
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return
    }
    const host = parsed.hostname.replace(/^www\./, '')
    if (parsed.protocol !== 'https:' || SOCIAL.test(host) || hosts.has(host)) return
    const clean = squash(plainText(title) ?? '')
    if (!clean || /official/i.test(clean)) return
    hosts.add(host)
    out.push({ title: clip(clean, 90), url: parsed.toString() })
  }
  for (const link of work?.links ?? []) add(link.title, link.url)
  if (bookWikiUrl) add('Wikipedia', bookWikiUrl)
  return out
}

/** Drop the photo credits and bare web addresses that ride along in copied biographies. */
export function withoutCredits(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter(
      (sentence) =>
        !/(photo(graph)?\s+(by|credit|courtesy)|\bCC[ -]BY\b|creative commons|https?:\/\/|wikimedia)/i.test(
          sentence,
        ),
    )
    .join(' ')
    .trim()
}

/** A Wikipedia summary we trust for an author: an article about a writer. */
const isWriter = (summary: WikiSummary | null) =>
  summary?.type === 'standard' &&
  /(writer|novelist|author|poet|essayist|playwright|journalist|historian|philosopher|scientist)/i.test(
    `${summary.description ?? ''} ${summary.extract ?? ''}`.slice(0, 400),
  )

function authorFrom(book: Book, s: AboutSources): BookAbout['author'] {
  const name = book.authors[0] ?? s.author?.name
  if (!name) return null
  const olBio = cleanOpenLibraryDescription(s.author?.bio)
  const wikiBio = isWriter(s.authorWiki) ? (plainText(s.authorWiki!.extract) ?? null) : null
  const authorKey = s.author?.key?.replace('/authors/', '') ?? s.doc?.author_key?.[0] ?? null
  const bio = olBio ?? wikiBio
  const bioSource = olBio
    ? authorKey
      ? { name: 'Open Library', url: `${OL}/authors/${authorKey}` }
      : null
    : wikiBio
      ? {
          name: 'Wikipedia',
          url:
            s.authorWiki!.content_urls?.desktop?.page ??
            `https://en.wikipedia.org/wiki/${encodeURIComponent(name)}`,
        }
      : null
  const photo = s.author?.photos?.find((id) => id > 0)
  const date = (value: string | undefined) =>
    value ? squash(value).replace(/^0(\d)\b/, '$1') || null : null
  const born = date(s.author?.birth_date)
  const died = date(s.author?.death_date)
  if (!bio && !photo && !born) return null
  return {
    name,
    bio: bio ? clip(withoutCredits(squash(bio)), 700) || null : null,
    bioSource,
    born,
    died,
    photoUrl: photo
      ? proxiedCover(`https://covers.openlibrary.org/a/id/${photo}-M.jpg?default=false`)
      : null,
  }
}

/** Shape what the catalogues returned into the card's sections. Pure. */
export function aboutFrom(book: Book, s: AboutSources): BookAbout {
  const { doc, work } = s
  const pages = book.pageCount ?? doc?.number_of_pages_median ?? null
  const counts = doc
    ? {
        ratings: doc.ratings_count ?? 0,
        wantToRead: doc.want_to_read_count ?? 0,
        reading: doc.currently_reading_count ?? 0,
        read: doc.already_read_count ?? 0,
      }
    : null
  const community =
    counts && counts.ratings + counts.wantToRead + counts.reading + counts.read > 0
      ? {
          // A handful of ratings says little; show the average from five up.
          rating:
            counts.ratings >= 5 && doc?.ratings_average
              ? Math.round(doc.ratings_average * 10) / 10
              : null,
          ...counts,
        }
      : null

  const places = labels(work?.subject_places ?? doc?.place, 5)
  const characters = labels(work?.subject_people ?? doc?.person, 6)
  const bookWikiUrl =
    s.bookWiki?.type === 'standard' ? (s.bookWiki.content_urls?.desktop?.page ?? null) : null
  const description = book.description
    ? null
    : (cleanOpenLibraryDescription(work?.description) ??
      (s.bookWiki?.type === 'standard' ? plainText(s.bookWiki.extract) : null))

  return {
    description,
    opening: openingFrom(work, doc),
    readingMinutes: pages && pages >= 20 ? Math.round(pages * MINUTES_PER_PAGE) : null,
    community,
    story: {
      places,
      times: labels(work?.subject_times ?? doc?.time, 3),
      characters,
      themes: themesFrom(work?.subjects ?? doc?.subject ?? [], [...places, ...characters]),
    },
    author: authorFrom(book, s),
    links: linksFrom(work, bookWikiUrl),
    editions: doc?.edition_count ?? null,
    languages: doc?.language?.length ?? null,
    openLibraryUrl: s.workId ? `${OL}/works/${s.workId}` : null,
  }
}

// ── Fetching ──────────────────────────────────────────────────────────────

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(6000),
      cf: { cacheTtl: WEEK, cacheEverything: true },
    } as RequestInit)
    return response.ok ? ((await response.json()) as T) : null
  } catch {
    return null
  }
}

/** The Wikipedia article title in a link like https://en.wikipedia.org/wiki/A_Little_Life. */
function wikipediaTitle(url: string | undefined): string | null {
  const match = url ? /^https?:\/\/en\.wikipedia\.org\/wiki\/([^#?]+)/.exec(url) : null
  return match ? decodeURIComponent(match[1]!) : null
}

const wikiSummary = (title: string) =>
  getJson<WikiSummary>(`${WIKIPEDIA}${encodeURIComponent(title.replace(/ /g, '_'))}`)

/** Which Open Library work a book is: its own id, or a match by title and author. */
async function workIdFor(book: Book): Promise<string | null> {
  if (book.source === 'openlibrary') return /^OL\d+W$/.test(book.sourceId) ? book.sourceId : null
  const match = await matchOpenLibrary({
    title: book.title,
    author: book.authors[0] ?? null,
    isbn: book.isbn13,
  }).catch(() => null)
  return match?.sourceId ?? null
}

/** Ask the open catalogues about a book. Never throws; missing parts stay empty. */
export async function aboutFor(book: Book): Promise<BookAbout> {
  const workId = await workIdFor(book)
  const [search, work] = workId
    ? await Promise.all([
        getJson<{ docs?: AboutDoc[] }>(
          `${OL}/search.json?q=${encodeURIComponent(`key:/works/${workId}`)}&fields=${FIELDS}&limit=1`,
        ),
        getJson<AboutWork>(`${OL}/works/${workId}.json`),
      ])
    : [null, null]
  const doc = search?.docs?.[0] ?? null

  const authorKey = doc?.author_key?.[0]
  const bookWikiTitle = wikipediaTitle(work?.links?.find((link) => wikipediaTitle(link.url))?.url)
  const [author, bookWiki] = await Promise.all([
    authorKey && /^OL\d+A$/.test(authorKey)
      ? getJson<AboutAuthor>(`${OL}/authors/${authorKey}.json`)
      : null,
    // Only needed when the book has no description of its own, or for its link.
    bookWikiTitle ? wikiSummary(bookWikiTitle) : null,
  ])

  // Wikipedia for the author only when Open Library has no biography.
  const authorName = book.authors[0] ?? author?.name
  const needsBio = !cleanOpenLibraryDescription(author?.bio)
  const authorWikiTitle =
    wikipediaTitle(author?.wikipedia) ??
    wikipediaTitle(author?.links?.find((link) => wikipediaTitle(link.url))?.url) ??
    authorName ??
    null
  const authorWiki = needsBio && authorWikiTitle ? await wikiSummary(authorWikiTitle) : null

  return aboutFrom(book, { workId, doc, work, author, authorWiki, bookWiki })
}

/**
 * The offline catalogue's answer: clearly sample values, so tests and local
 * development exercise every part of the card without the network.
 */
export function fixtureAbout(book: Book): BookAbout {
  return aboutFrom(book, {
    workId: book.sourceId,
    doc: {
      edition_count: 12,
      language: ['eng', 'fre', 'ger'],
      ratings_average: 4.12,
      ratings_count: 212,
      want_to_read_count: 3120,
      currently_reading_count: 140,
      already_read_count: 860,
      number_of_pages_median: book.pageCount ?? 320,
    },
    work: {
      excerpts: [
        {
          comment: 'first sentence',
          excerpt: `Sample opening lines from the offline catalogue, standing in for the first page of ${book.title}.`,
        },
      ],
      subject_places: ['A house of endless halls'],
      subject_times: ['Long ago'],
      subject_people: ['The narrator'],
      subjects: ['Memory', 'Solitude', 'Fiction'],
      links: [{ title: 'A sample review', url: 'https://example.org/review' }],
    },
    author: book.authors[0]
      ? {
          key: '/authors/OL1A',
          name: book.authors[0],
          bio: `Sample biography from the offline catalogue for ${book.authors[0]}.`,
          birth_date: '1959',
        }
      : null,
    authorWiki: null,
    bookWiki: null,
  })
}
