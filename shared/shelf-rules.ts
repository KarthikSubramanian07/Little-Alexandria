import type { Shelf } from './types'

interface Dated {
  shelf: Shelf
  startedAt: string | null
  finishedAt: string | null
}

/**
 * The dates a book should carry after moving to `to`, given today's local date.
 * Starting a book stamps the start date; finishing it stamps the finish date.
 * We never overwrite a date the reader set, and a finish date can't precede
 * the start, so a same-day finish also backfills a missing start.
 */
export function datesForShelf(
  entry: Dated,
  to: Shelf,
  today: string,
): Pick<Dated, 'startedAt' | 'finishedAt'> {
  if (to === entry.shelf) return { startedAt: entry.startedAt, finishedAt: entry.finishedAt }
  switch (to) {
    case 'want_to_read':
      return { startedAt: null, finishedAt: null }
    case 'reading':
      return { startedAt: entry.startedAt ?? today, finishedAt: null }
    case 'read': {
      const finishedAt = entry.finishedAt ?? today
      const startedAt =
        entry.startedAt && entry.startedAt <= finishedAt
          ? entry.startedAt
          : entry.startedAt
            ? finishedAt
            : null
      return { startedAt, finishedAt }
    }
  }
}

/** Today's date in the reader's own time zone, as 'YYYY-MM-DD'. */
export function localToday(now = new Date()): string {
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}
