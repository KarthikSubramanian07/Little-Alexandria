import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { Dialog } from 'radix-ui'
import { useDeferredValue, useEffect, useState } from 'react'
import { SHELF_LABELS, SHELVES, type SearchResult, type Shelf } from '../../shared/types'
import { api } from '../lib/api'
import { snappy } from '../lib/motion'
import { useAddBook, useLibrary } from '../lib/queries'

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return debounced
}

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shelf: Shelf
  onShelfChange: (shelf: Shelf) => void
}

export function SearchDialog({ open, onOpenChange, shelf, onShelfChange }: SearchDialogProps) {
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query.trim(), 280)
  const deferred = useDeferredValue(debounced)
  const search = useQuery({
    queryKey: ['search', deferred],
    queryFn: ({ signal }) => api.search(deferred, signal),
    enabled: open && deferred.length >= 2,
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  })
  const { data: library } = useLibrary()
  const shelved = new Map(library?.entries.map((entry) => [entry.book.id, entry]) ?? [])
  const results = deferred.length >= 2 ? (search.data?.results ?? []) : []
  const waiting = query.trim().length >= 2 && (debounced !== query.trim() || search.isFetching)

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setQuery('')
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(var(--shadow-rgb)/0.35)] backdrop-blur-[3px] data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content
          className="fixed inset-x-3 top-[8dvh] z-50 mx-auto flex max-h-[84dvh] max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_40px_80px_-30px_rgb(var(--shadow-rgb)/0.6)] data-[state=open]:animate-[dialog-in_260ms_var(--ease-out-soft)] sm:top-[12dvh]"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Find a book</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <svg viewBox="0 0 20 20" className="size-5 shrink-0 text-ink-faint" aria-hidden>
              <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M13 13 L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, author, or ISBN"
              aria-label="Search for a book"
              className="min-w-0 flex-1 bg-transparent font-display text-xl outline-none placeholder:text-ink-faint/80"
              spellCheck={false}
            />
            {waiting && <Spinner />}
            <Dialog.Close className="rounded-md px-2 py-1 font-mono text-xs text-ink-faint hover:text-ink">esc</Dialog.Close>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto border-b border-line px-5 py-2.5 text-sm">
            <span className="shrink-0 font-hand text-lg text-ink-faint">add to</span>
            {SHELVES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onShelfChange(option)}
                aria-pressed={option === shelf}
                className={clsx(
                  'relative shrink-0 rounded-full px-3 py-1 transition-colors',
                  option === shelf ? 'text-on-moss' : 'text-ink-soft hover:text-ink',
                )}
              >
                {option === shelf && (
                  <motion.span layoutId="shelf-pill" transition={snappy} className="absolute inset-0 rounded-full bg-moss" />
                )}
                <span className="relative">{SHELF_LABELS[option]}</span>
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {query.trim().length < 2 ? (
              <Hint>Try “Earthsea”, “Toni Morrison”, or the ISBN on the back cover.</Hint>
            ) : search.isError ? (
              <Hint>{search.error.message}</Hint>
            ) : results.length === 0 && !waiting ? (
              <Hint>Nothing by that name in the stacks. Try fewer words, or the author.</Hint>
            ) : (
              <ul className="divide-y divide-line">
                {results.map((result, index) => (
                  <ResultRow
                    key={`${result.source}:${result.sourceId}`}
                    result={result}
                    index={index}
                    shelf={shelf}
                    existing={shelved.get(`${result.source}:${result.sourceId}`) ?? null}
                    onNavigate={() => onOpenChange(false)}
                  />
                ))}
              </ul>
            )}
          </div>
          <p className="border-t border-line px-5 py-2 text-[11px] text-ink-faint">
            Book data from Open Library and Google Books{' '}
            <span aria-hidden>·</span> covers belong to their publishers
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ResultRow({
  result,
  index,
  shelf,
  existing,
  onNavigate,
}: {
  result: SearchResult
  index: number
  shelf: Shelf
  existing: { id: string; shelf: Shelf } | null
  onNavigate: () => void
}) {
  const add = useAddBook()
  const [thumbFailed, setThumbFailed] = useState(false)
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.03, duration: 0.25 }}
      className="flex items-center gap-4 px-5 py-3"
    >
      <div className="h-[72px] w-12 shrink-0 overflow-hidden rounded-[3px] bg-paper-deep shadow-[2px_3px_8px_-3px_rgb(var(--shadow-rgb)/0.5)]">
        {result.thumbnailUrl && !thumbFailed ? (
          <img
            src={result.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <div className="grid h-full w-full place-items-center font-display text-lg text-ink-faint">
            {result.title.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[1.05rem] leading-snug font-medium">{result.title}</p>
        <p className="truncate text-sm text-ink-soft">
          {result.authors.join(', ') || 'Unknown author'}
          {result.publishedYear ? <span className="text-ink-faint"> · {result.publishedYear}</span> : null}
        </p>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {existing ? (
          <motion.div key="shelved" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={snappy}>
            <Link
              to="/library/$entryId"
              params={{ entryId: existing.id }}
              onClick={onNavigate}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-moss-soft px-3 py-1.5 text-sm text-moss"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
                <path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {SHELF_LABELS[existing.shelf]}
            </Link>
          </motion.div>
        ) : (
          <motion.button
            key="add"
            type="button"
            disabled={add.isPending}
            onClick={() => add.mutate({ result, shelf })}
            whileTap={{ scale: 0.92 }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-moss hover:bg-moss hover:text-on-moss disabled:opacity-60"
            aria-label={`Add ${result.title} to ${SHELF_LABELS[shelf]}`}
          >
            {add.isPending ? <Spinner small /> : <span aria-hidden className="text-base leading-none">+</span>}
            Shelve
          </motion.button>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="px-6 py-14 text-center font-hand text-xl text-ink-faint">{children}</p>
}

function Spinner({ small }: { small?: boolean }) {
  return (
    <span
      aria-label="Searching"
      role="status"
      className={clsx(
        'inline-block animate-spin rounded-full border-2 border-line-strong border-t-moss',
        small ? 'size-3.5' : 'size-4',
      )}
    />
  )
}
