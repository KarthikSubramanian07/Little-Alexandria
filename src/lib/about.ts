// Reading the open catalogues' notes on a book, and turning them into the
// card's short facts.
import { useQuery } from '@tanstack/react-query'
import type { Book, BookAbout } from '../../shared/types'
import { api } from './api'

export function useBookAbout(book: Book) {
  return useQuery({
    queryKey: ['about', book.id],
    queryFn: () => api.about(book.id),
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  })
}

/** "about 14 hours", "about 50 minutes". */
export function readingTime(minutes: number): string {
  if (minutes < 60) return `about ${Math.max(5, Math.round(minutes / 5) * 5)} minutes`
  const hours = Math.round(minutes / 60)
  return `about ${hours} hour${hours === 1 ? '' : 's'}`
}

const count = (value: number) => value.toLocaleString()

/** Extra facts for the card's top line: reading time, and editions. */
export function aboutFacts(about: BookAbout | undefined) {
  const facts: { label: string; value: string }[] = []
  if (about?.readingMinutes)
    facts.push({ label: 'Reading time', value: readingTime(about.readingMinutes) })
  if (about?.editions && about.editions > 1) {
    const languages =
      about.languages && about.languages > 1 ? ` in ${about.languages} languages` : ''
    facts.push({ label: 'Editions', value: `${count(about.editions)}${languages}` })
  }
  return facts
}
