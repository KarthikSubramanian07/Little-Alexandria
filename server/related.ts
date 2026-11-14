// "More like this" for a book: the author's other work, books on the same
// subjects, and real film and TV adaptations from Wikidata. Every upstream
// call is cached at the edge for a week, so popular books cost nothing.
import type { LibraryEntry, SearchResult } from '../shared/types'
import { cleanOpenLibraryDescription } from './sources/text'
import { dedupe } from './sources'
import { normalizeTitle } from './sources/match'
import { toSearchResult, type SearchDoc } from './sources/openlibrary'

const OL = 'https://openlibrary.org'
const HEADERS = { 'User-Agent': 'LittleAlexandria/1.0 (+https://little-alexandria.pages.dev)' }
const FIELDS =
  'key,title,author_name,first_publish_year,cover_i,number_of_pages_median,editions,editions.cover_i,editions.language'
const WEEK = 60 * 60 * 24 * 7

interface Adaptation {
  title: string
  year: number | null
  kind: 'film' | 'series' | 'other'
  url: string
}

interface Related {
  description: string | null
  byAuthor: SearchResult[]
  similar: SearchResult[]
  adaptations: Adaptation[]
}

const cached = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, cf: { cacheTtl: WEEK, cacheEverything: true } } as RequestInit)

async function olSearch(params: Record<string, string>, limit: number): Promise<SearchResult[]> {
  const query = new URLSearchParams({ ...params, fields: FIELDS, limit: String(limit), lang: 'en' })
  const response = await cached(`${OL}/search.json?${query}`, { headers: HEADERS })
  if (!response.ok) return []
  const body = (await response.json()) as { docs?: SearchDoc[] }
  // Recommend books a reader here can actually pick up: works with an English
  // edition, one record per book (Open Library keeps translations as separate works).
  const english = (body.docs ?? []).filter((doc) => {
    if (!doc.key?.startsWith('/works/')) return false
    const languages = doc.editions?.docs?.[0]?.language
    return !languages || languages.includes('eng')
  })
  return dedupe(english.map(toSearchResult))
}

/** A loose identity for a book, so a duplicate catalogue record still counts as owned. */
const looseKey = (title: string, author: string | undefined) =>
  `${normalizeTitle(title)}|${(author ?? '').toLowerCase().split(' ').at(-1) ?? ''}`

/** Subjects specific enough to recommend from: no "Fiction", no NYT list tags. */
function usefulSubjects(subjects: readonly string[]): string[] {
  const generic =
    /^(fiction|literature|novel|english literature|american literature|large type books|accessible book|protected daisy|in library|general|reading level|new york times|nyt:|award:|form:|genre:)/i
  return subjects.filter(
    (subject) => !generic.test(subject) && !subject.includes('=') && subject.length < 40,
  )
}

const notIn = (exclude: Set<string>) => (result: SearchResult) =>
  !exclude.has(`${result.source}:${result.sourceId}`) &&
  !exclude.has(looseKey(result.title, result.authors[0])) &&
  result.thumbnailUrl !== null

const sparqlString = (value: string) => value.replace(/\\/g, '').replace(/"/g, '\\"')

/**
 * Films and series based on a book, via Wikidata. Open Library has duplicate
 * work records, so we match either the work id or the exact English title
 * together with the author's surname.
 */
async function adaptationsFor(book: {
  sourceId: string
  title: string
  authors: string[]
}): Promise<Adaptation[]> {
  const title = sparqlString(book.title.split(':')[0]!.trim())
  const surname = sparqlString((book.authors[0] ?? '').split(' ').at(-1)?.toLowerCase() ?? '')
  const byId = /^OL\d+W$/.test(book.sourceId) ? `{ ?book wdt:P648 "${book.sourceId}" } UNION ` : ''
  const sparql = `
    SELECT ?item ?itemLabel (MIN(YEAR(?date)) AS ?year) (SAMPLE(?article) AS ?wiki)
           (MAX(IF(?cls IN (wd:Q5398426, wd:Q1259759, wd:Q581714, wd:Q21191270), 1, 0)) AS ?series)
           (MAX(IF(?cls IN (wd:Q11424, wd:Q506240, wd:Q24862, wd:Q202866, wd:Q24869), 1, 0)) AS ?film)
    WHERE {
      ${byId}{ ?book rdfs:label "${title}"@en ; wdt:P50 ?author .
        ?author rdfs:label ?authorName . FILTER(LANG(?authorName) = "en" && CONTAINS(LCASE(?authorName), "${surname}")) }
      ?item wdt:P144 ?book ; wdt:P31/wdt:P279? ?cls .
      OPTIONAL { ?item wdt:P577 ?date }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    GROUP BY ?item ?itemLabel
    ORDER BY ?year
    LIMIT 12`
  try {
    const response = await cached(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`,
      {
        headers: { ...HEADERS, Accept: 'application/sparql-results+json' },
      },
    )
    if (!response.ok) return []
    const body = (await response.json()) as {
      results: { bindings: Record<string, { value: string } | undefined>[] }
    }
    return body.results.bindings
      .flatMap((row): Adaptation[] => {
        const label = row.itemLabel?.value
        const item = row.item?.value
        // Unlabelled items come back as bare Q-ids; they aren't worth showing.
        if (!label || !item || /^Q\d+$/.test(label)) return []
        const kind =
          row.series?.value === '1' ? 'series' : row.film?.value === '1' ? 'film' : 'other'
        if (kind === 'other') return []
        return [
          {
            title: label,
            year: row.year ? Number(row.year.value) || null : null,
            kind,
            url: row.wiki?.value ?? item,
          },
        ]
      })
      .slice(0, 6)
  } catch {
    return []
  }
}

export async function relatedFor(entry: LibraryEntry, entries: LibraryEntry[]): Promise<Related> {
  const { book } = entry
  const exclude = ownedKeys(entries)
  exclude.add(book.id)
  exclude.add(looseKey(book.title, book.authors[0]))
  const isOpenLibrary = book.source === 'openlibrary' || book.source === 'fixture'
  const work = isOpenLibrary
    ? await cached(`${OL}/works/${book.sourceId}.json`, { headers: HEADERS })
        .then((response) =>
          response.ok ? (response.json() as Promise<Record<string, unknown>>) : null,
        )
        .catch(() => null)
    : null
  const subjects = usefulSubjects(Array.isArray(work?.subjects) ? (work.subjects as string[]) : [])
  const author = book.authors[0]

  const [byAuthor, similar, adaptations] = await Promise.all([
    author ? olSearch({ author, sort: 'editions' }, 12) : Promise.resolve([]),
    subjects.length > 0
      ? olSearch(
          {
            q: subjects
              .slice(0, 2)
              .map((subject) => `subject:"${subject.replace(/"/g, '')}"`)
              .join(' '),
            sort: 'editions',
          },
          16,
        )
      : book.genres[0]
        ? olSearch({ subject: book.genres[0].toLowerCase(), sort: 'editions' }, 16)
        : Promise.resolve([]),
    adaptationsFor(book),
  ])

  const authorPicks = byAuthor.filter(notIn(exclude)).slice(0, 8)
  for (const pick of authorPicks) exclude.add(looseKey(pick.title, pick.authors[0]))
  return {
    description: book.description ?? cleanOpenLibraryDescription(work?.description),
    byAuthor: authorPicks,
    // Different authors make for better discovery than more of the same author.
    similar: similar
      .filter(notIn(exclude))
      .filter((result) => result.authors[0] !== author)
      .slice(0, 8),
    adaptations,
  }
}

/** Picks for the Discover page, from the authors and genres a reader loves. */
function ownedKeys(entries: LibraryEntry[]) {
  const keys = new Set<string>()
  for (const entry of entries) {
    keys.add(entry.book.id)
    keys.add(looseKey(entry.book.title, entry.book.authors[0]))
  }
  return keys
}

export async function discoverFor(entries: LibraryEntry[]) {
  const shelved = ownedKeys(entries)
  const loved = entries
    .filter((entry) => entry.shelf === 'read' && (entry.rating ?? 0) >= 4)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.updatedAt - a.updatedAt)
  const authors = [...new Set(loved.map((entry) => entry.book.authors[0]).filter(Boolean))].slice(
    0,
    2,
  ) as string[]
  const genreCounts = new Map<string, number>()
  for (const entry of entries) {
    if (entry.shelf === 'want_to_read') continue
    for (const genre of entry.book.genres) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1)
  }
  const genres = [...genreCounts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([genre]) => genre)

  const sections = await Promise.all([
    ...authors.map(async (author) => ({
      kind: 'author' as const,
      title: `Because you loved ${author}`,
      books: (await olSearch({ author, sort: 'editions' }, 14)).filter(notIn(shelved)).slice(0, 8),
    })),
    ...genres.map(async (genre) => ({
      kind: 'genre' as const,
      title: `More ${genre.toLowerCase()} worth a shelf`,
      books: (await olSearch({ subject: genre.toLowerCase(), sort: 'rating' }, 20))
        .filter(notIn(shelved))
        .slice(0, 8),
    })),
  ])
  const seen = new Set<string>()
  return sections
    .map((section) => ({
      ...section,
      books: section.books.filter((book) => {
        const key = looseKey(book.title, book.authors[0])
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }),
    }))
    .filter((section) => section.books.length > 0)
}
