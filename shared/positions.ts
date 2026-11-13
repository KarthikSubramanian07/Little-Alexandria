import { generateKeyBetween } from 'fractional-indexing'

/** Position keys compare bytewise (SQLite BINARY collation), never by locale. */
export const comparePositions = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** A key that sorts before `first`: new and moved books land at the front of a shelf. */
export const frontOf = (first: string | null) => generateKeyBetween(null, first)

/**
 * The key for a book dropped at `index` among `others` (the shelf in order,
 * without the dragged book).
 */
export function positionAt(others: readonly { position: string }[], index: number): string {
  const clamped = Math.max(0, Math.min(index, others.length))
  const before = others[clamped - 1]?.position ?? null
  const after = others[clamped]?.position ?? null
  return generateKeyBetween(before, after)
}
