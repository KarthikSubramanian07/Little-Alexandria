// Open Library subjects and Google categories are noisy ("nyt:combined-print...",
// "Fiction, general", "Accessible book"). We fold them into a short, human list.

const RULES: [genre: string, pattern: RegExp][] = [
  ['Science Fiction', /science.?fiction|sci-?fi|space opera|dystopi|cyberpunk|time travel/i],
  ['Fantasy', /fantasy|magic|dragons|wizards|fairy tales|mythical/i],
  ['Mystery', /myster|detective|crime|whodunit|sleuth/i],
  ['Thriller', /thriller|suspense|espionage|spy stories/i],
  ['Horror', /horror|ghost stories|supernatural|vampires/i],
  ['Romance', /romance|love stories/i],
  ['Historical Fiction', /historical fiction|fiction.*histor/i],
  ['Young Adult', /young adult|juvenile fiction|teen/i],
  ['Children’s', /children|picture books|juvenile literature/i],
  ['Graphic Novels', /graphic novel|comics|manga/i],
  ['Poetry', /poetry|poems|verse/i],
  ['Classics', /classic/i],
  ['Biography', /biograph|autobiograph/i],
  ['Memoir', /memoir/i],
  [
    'History',
    /^(?!.*criticism)(world )?history\b|military history|world war|civilization|ancient (rome|greece|egypt|history)/i,
  ],
  ['Philosophy', /philosoph|ethics|metaphysics|stoic/i],
  ['Psychology', /psycholog|mental health|behavior/i],
  ['Science', /science|physics|biology|chemistry|astronomy|mathematics|evolution/i],
  ['Technology', /technology|computers|programming|software|engineering/i],
  ['Business', /business|economics|management|finance|entrepreneur/i],
  ['Self-Help', /self-help|self help|personal development|happiness|success/i],
  ['Politics', /politic|government|sociology|social science/i],
  ['Religion', /religion|spiritual|theology|bible|buddhism/i],
  ['Art & Design', /\bart\b|design|architecture|photography|music/i],
  ['Travel', /^travel|travel writing|voyages and travels|guidebooks/i],
  ['Food', /cooking|cookbook|food|recipes/i],
  ['Essays', /essays/i],
  ['Literary Fiction', /literary|literature|fiction/i],
]

/** Every genre name we use; an import's genre hint must be one of these. */
export const KNOWN_GENRES: ReadonlySet<string> = new Set(RULES.map(([genre]) => genre))

/**
 * Map raw subjects to at most `limit` friendly genres. Each subject counts only
 * toward its most specific genre, so "Science fiction" never also reads as
 * "Science", and "Space travel" never as "Travel".
 */
export function normalizeGenres(subjects: readonly string[], limit = 3): string[] {
  const hits = new Map<string, number>()
  for (const subject of subjects) {
    const rule = RULES.find(([, pattern]) => pattern.test(subject))
    if (rule) hits.set(rule[0], (hits.get(rule[0]) ?? 0) + 1)
  }
  // "Literary Fiction" is the catch-all; drop it when something sharper matched.
  if (hits.size > 1) hits.delete('Literary Fiction')
  const order = (genre: string) => RULES.findIndex(([name]) => name === genre)
  return [...hits]
    .sort((a, b) => b[1] - a[1] || order(a[0]) - order(b[0]))
    .slice(0, limit)
    .map(([genre]) => genre)
}
