import type { UseQueryResult } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { SHELF_LABELS, type LibraryEntry, type SearchResult } from '../../shared/types'
import type { Adaptation, RelatedResponse } from '../lib/api'
import { snappy } from '../lib/motion'
import { useAddBook, useLibrary } from '../lib/queries'

/** A book you don't own yet: cover, title, and a one-tap "shelve" that stays put once pressed. */
function MiniBook({ result, index = 0 }: { result: SearchResult; index?: number }) {
  const add = useAddBook()
  const { data } = useLibrary()
  const [failed, setFailed] = useState(false)
  const owned = data?.entries.find((entry) => entry.book.id === `${result.source}:${result.sourceId}`)
  return (
    <motion.li
      className="flex w-28 shrink-0 list-none flex-col sm:w-32"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
    >
      <div className="aspect-[2/3] overflow-hidden rounded-[3px] bg-paper-deep shadow-[3px_5px_14px_-6px_rgb(var(--shadow-rgb)/0.6)]">
        {result.thumbnailUrl && !failed ? (
          <img src={result.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(true)} />
        ) : (
          <div className="grid h-full place-items-center p-2 text-center font-display text-sm text-ink-soft">{result.title}</div>
        )}
      </div>
      <p className="mt-2 line-clamp-2 font-display text-sm leading-snug">{result.title}</p>
      <p className="truncate text-xs text-ink-faint">{result.authors[0] ?? ''}</p>
      <AnimatePresence mode="wait" initial={false}>
        {owned ? (
          <motion.span key="owned" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={snappy} className="mt-1.5 text-xs font-medium text-moss">
            ✓ {SHELF_LABELS[owned.shelf]}
          </motion.span>
        ) : (
          <motion.button
            key="add"
            type="button"
            whileTap={{ scale: 0.92 }}
            disabled={add.isPending}
            onClick={() => add.mutate({ result, shelf: 'want_to_read' })}
            className="mt-1.5 self-start rounded-full border border-line-strong px-2.5 py-0.5 text-xs font-medium transition hover:border-moss hover:bg-moss hover:text-on-moss disabled:opacity-50"
            aria-label={`Want to read: ${result.title}`}
          >
            <svg viewBox="0 0 12 12" className="mr-1 inline size-2.5 align-[-1px]" aria-hidden>
              <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Want to read
          </motion.button>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

export function MiniShelf({ title, books, action }: { title: string; books: SearchResult[]; action?: React.ReactNode }) {
  if (books.length === 0) return null
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h3 className="font-display text-xl font-medium">{title}</h3>
        {action}
      </div>
      <ol className="scrollbar-none -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
        {books.map((book, i) => (
          <MiniBook key={`${book.source}:${book.sourceId}`} result={book} index={i} />
        ))}
      </ol>
    </section>
  )
}

function OnScreen({ adaptations }: { adaptations: Adaptation[] }) {
  if (adaptations.length === 0) return null
  return (
    <section className="mt-10">
      <h3 className="font-display text-xl font-medium">On screen</h3>
      <p className="font-hand text-base text-ink-faint">for when you want to see it moving</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {adaptations.map((adaptation) => (
          <li key={adaptation.url}>
            <a
              href={adaptation.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-line-strong px-3.5 py-1.5 text-sm transition hover:border-moss hover:text-moss"
            >
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                {adaptation.kind === 'series' ? (
                  <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                    <rect x="2.5" y="4.5" width="15" height="10" rx="1.5" />
                    <path d="M7 17.5h6M10 14.5v3" strokeLinecap="round" />
                  </g>
                ) : (
                  <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                    <rect x="2.5" y="5" width="15" height="11" rx="1.5" />
                    <path d="M2.5 8h15M6 5l-1.5 3M10 5l-1.5 3M14 5l-1.5 3" strokeLinecap="round" />
                  </g>
                )}
              </svg>
              {adaptation.title}
              {adaptation.year && <span className="font-mono text-xs text-ink-faint">{adaptation.year}</span>}
              <span className="sr-only">({adaptation.kind === 'series' ? 'TV series' : 'film'}, opens Wikipedia)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Beneath a book's card: more by the author, books like it, and its adaptations. */
export function RelatedShelves({
  entry,
  related,
  onSearch,
}: {
  entry: LibraryEntry
  related: UseQueryResult<RelatedResponse>
  onSearch?: (query: string) => void
}) {
  const author = entry.book.authors[0]
  if (related.isPending) {
    return (
      <div className="mt-12 border-t border-line pt-8" aria-busy aria-label="Finding books like this one">
        <div className="h-6 w-48 animate-pulse rounded bg-line" />
        <div className="mt-4 flex gap-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[2/3] w-28 animate-pulse rounded bg-line/70" />
          ))}
        </div>
      </div>
    )
  }
  if (related.isError || !related.data) return null
  const { byAuthor, similar, adaptations } = related.data
  if (byAuthor.length + similar.length + adaptations.length === 0) return null
  return (
    <div className="mt-12 border-t border-line pt-2">
      <p className="mt-6 font-hand text-xl text-moss">if you liked this, the shelves whisper…</p>
      <MiniShelf
        title={author ? `More by ${author}` : 'More by this author'}
        books={byAuthor}
        action={
          author && onSearch ? (
            <button type="button" onClick={() => onSearch(author)} className="text-sm font-medium text-moss hover:underline">
              All their books
            </button>
          ) : undefined
        }
      />
      <MiniShelf title="Readers of this also shelve" books={similar} />
      <OnScreen adaptations={adaptations} />
    </div>
  )
}
