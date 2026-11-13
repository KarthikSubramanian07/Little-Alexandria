import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getPlatformProxy } from 'wrangler'

/**
 * A real, in-memory D1 (SQLite in workerd) with our migrations applied, so the
 * tests exercise the same SQL, constraints, and foreign keys as production.
 */
export async function testDatabase() {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: 'wrangler.jsonc',
    persist: false,
  })
  const db = proxy.env.DB
  const dir = 'migrations'
  for (const file of readdirSync(dir).sort()) {
    const sql = readFileSync(join(dir, file), 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
    for (const statement of sql
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)) {
      await db.prepare(statement).run()
    }
  }
  const reset = async () => {
    for (const table of ['sessions', 'user_books', 'reading_goals', 'books', 'users']) {
      await db.prepare(`DELETE FROM ${table}`).run()
    }
  }
  return { db, reset, dispose: proxy.dispose }
}
