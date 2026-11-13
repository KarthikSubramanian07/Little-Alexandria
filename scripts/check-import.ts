// Dry-run an import against the live catalogue, without touching any library.
//   pnpm dlx tsx scripts/check-import.ts <file.csv>... > report.json
// Prints a JSON report: how many rows matched, and every row that didn't.
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { mergeRows, parseReadingList } from '../shared/import'
import { matchOpenLibrary } from '../server/sources/openlibrary'

const files = process.argv.slice(2)
const rows = mergeRows(
  files.flatMap((file) => parseReadingList(readFileSync(file, 'utf8'), basename(file)).rows),
)
const results: { title: string; author: string | null; shelf: string; match: string | null }[] = []
let next = 0
async function worker() {
  while (next < rows.length) {
    const row = rows[next++]!
    let match: Awaited<ReturnType<typeof matchOpenLibrary>> = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        match = await matchOpenLibrary(row)
        break
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)))
      }
    }
    results.push({
      title: row.title,
      author: row.author,
      shelf: row.shelf,
      match: match
        ? `${match.title} — ${match.authors[0] ?? '?'} (${match.sourceId}${match.coverUrl ? '' : ', no cover'})`
        : null,
    })
    if (results.length % 50 === 0) console.error(`${results.length}/${rows.length}`)
  }
}
await Promise.all([worker(), worker(), worker()])
const unmatched = results.filter((result) => !result.match)
console.log(
  JSON.stringify(
    {
      rows: rows.length,
      matched: results.length - unmatched.length,
      withoutCover: results.filter((result) => result.match?.includes('no cover')).length,
      unmatched,
      sample: results.filter((result) => result.match).slice(0, 40),
    },
    null,
    2,
  ),
)
