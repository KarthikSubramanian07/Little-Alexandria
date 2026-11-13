// Deciding whether a catalogue result is the book a reading list meant.
// "The Shining, Stephen King" should find the novel, not a study guide to it,
// and "Demon Copperfield, Barbara Kingsolver" should still find Demon Copperhead.

const fold = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, '')

/** Lowercase, unaccented, no subtitle, no punctuation, no leading article. */
export function normalizeTitle(title: string): string {
  return fold(title)
    .split(/[:([]| - /)[0]!
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(the|a|an) /, '')
    .trim()
}

/** The whole title, subtitle and all, for spotting exact matches. */
const fullTitle = (title: string) =>
  fold(title)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(the|a|an) /, '')
    .trim()

const tokens = (text: string) => new Set(text.split(' ').filter(Boolean))

/** Dice coefficient over words: 1 for the same title, 0 for nothing shared. */
export function titleSimilarity(a: string, b: string): number {
  const left = normalizeTitle(a)
  const right = normalizeTitle(b)
  if (!left || !right) return 0
  if (left === right) return 1
  const x = tokens(left)
  const y = tokens(right)
  let shared = 0
  for (const word of x) if (y.has(word)) shared++
  return (2 * shared) / (x.size + y.size)
}

/** "Salena Zito & Brad Todd" -> ["Salena Zito", "Brad Todd"]. */
export function splitAuthors(value: string | null): string[] {
  return (value ?? '')
    .split(/\s*(?:&|\band\b|;|,(?=\s*[A-Z][a-z]+\s+[A-Z]))\s*/)
    .map((name) => name.trim())
    .filter(Boolean)
}

const surname = (name: string) =>
  fold(name)
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z\s-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((part) => !['jr', 'sr', 'ii', 'iii', 'phd', 'md'].includes(part))
    .at(-1) ?? ''

/** Two surnames match if equal, or one typo apart when long enough ("Chabo" ~ "Chabon"). */
function surnamesMatch(a: string, b: string) {
  if (a === b) return a.length > 0
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false
  let edits = 0
  for (let i = 0, j = 0; i < a.length || j < b.length;) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return true
}

/** Does any of the candidate's authors share a surname with any listed author? */
export function authorMatches(wanted: string | null, candidates: readonly string[]): boolean {
  const names = splitAuthors(wanted)
  if (names.length === 0) return true
  const theirs = candidates.map(surname)
  return names.some((name) => theirs.some((other) => surnamesMatch(surname(name), other)))
}

export interface Candidate {
  title: string
  authors: string[]
  editionCount?: number
}

interface MatchOptions {
  /** The catalogue already filtered by author, so don't second-guess it (it may use another script). */
  trustAuthor?: boolean
}

/** The best candidate for a list row, or null if none is convincing. */
export function bestMatch<T extends Candidate>(
  title: string,
  author: string | null,
  candidates: T[],
  { trustAuthor = false }: MatchOptions = {},
): T | null {
  let best: { candidate: T; score: number } | null = null
  for (const candidate of candidates) {
    const similarity = titleSimilarity(title, candidate.title)
    const byAuthor = author ? trustAuthor || authorMatches(author, candidate.authors) : false
    const threshold = !author ? 0.85 : byAuthor ? (trustAuthor ? 0.6 : 0.5) : Infinity
    if (similarity < threshold) continue
    const exact = fullTitle(title) === fullTitle(candidate.title) ? 0.15 : 0
    // Among equals, the edition everyone owns beats the study guide nobody does.
    const popularity = Math.min(0.1, Math.log10((candidate.editionCount ?? 1) + 1) * 0.04)
    const score = similarity + exact + popularity
    if (!best || score > best.score) best = { candidate, score }
  }
  return best?.candidate ?? null
}
