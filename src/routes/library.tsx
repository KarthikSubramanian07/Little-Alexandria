import { createFileRoute, redirect, useNavigate, useParams } from '@tanstack/react-router'
import { AnimatePresence } from 'motion/react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { LibraryEntry, Shelf } from '../../shared/types'
import { AppShell } from '../components/AppShell'
import { BookDetail } from '../components/BookDetail'
import { Bookcase, BookcaseSkeleton } from '../components/Bookcase'
import { ImportDialog, ImportPill } from '../components/ImportDialog'
import { SearchDialog } from '../components/SearchDialog'
import { importer } from '../lib/importer'
import { libraryQuery, meQuery, useLibrary, useMe } from '../lib/queries'

export const Route = createFileRoute('/library')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQuery).catch(() => null)
    if (!user) throw redirect({ to: '/' })
    return { user }
  },
  loader: ({ context }) => void context.queryClient.prefetchQuery(libraryQuery),
  component: LibraryPage,
})

/** Lowercase, unaccented text for forgiving filtering. */
const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

function matches(entry: LibraryEntry, terms: string[]) {
  const haystack = fold([entry.book.title, entry.book.subtitle, ...entry.book.authors, ...entry.book.genres].join(' '))
  return terms.every((term) => haystack.includes(term))
}

function LibraryPage() {
  const { data: user } = useMe()
  const { data, isPending, isError, error, refetch } = useLibrary()
  const navigate = useNavigate()
  const { entryId } = useParams({ strict: false })
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchShelf, setSearchShelf] = useState<Shelf>('want_to_read')
  const [searchSeed, setSearchSeed] = useState({ key: 0, query: '' })
  const [importOpen, setImportOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const deferredFilter = useDeferredValue(filter)

  useEffect(() => {
    if (user) importer.restore(user.id)
  }, [user])

  const terms = fold(deferredFilter).split(/\s+/).filter(Boolean)
  const entries = useMemo(
    () => (terms.length && data ? data.entries.filter((entry) => matches(entry, terms)) : (data?.entries ?? [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, deferredFilter],
  )
  const openEntry = data?.entries.find((entry) => entry.id === entryId) ?? null

  const findBook = (shelf: Shelf = searchShelf, query = '') => {
    setSearchShelf(shelf)
    setSearchSeed((seed) => ({ key: seed.key + 1, query }))
    setSearchOpen(true)
  }

  if (!user) return null
  const total = data?.entries.length ?? 0
  return (
    <AppShell user={user} onSearch={() => findBook()}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="font-hand text-xl text-moss">
            {greeting()}, {user.name.split(' ')[0]}
          </p>
          <h1 className="font-display text-[clamp(2.2rem,5vw,3.4rem)] leading-none font-medium tracking-tight">Your shelves</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {total > 8 && (
            <label className="field flex items-center gap-2 rounded-full border border-line-control bg-card px-3.5 py-1.5">
              <svg viewBox="0 0 20 20" className="size-4 text-ink-faint" aria-hidden>
                <path d="M3 5h14M6 10h8M9 15h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span className="sr-only">Filter your shelves</span>
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter your shelves"
                className="w-36 bg-transparent text-sm outline-none placeholder:text-ink-faint pointer-coarse:text-base sm:w-44"
              />
              {filter && (
                <button type="button" onClick={() => setFilter('')} aria-label="Clear filter" className="text-ink-faint hover:text-ink">
                  ×
                </button>
              )}
            </label>
          )}
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded-full border border-line-strong px-4 py-1.5 text-sm font-medium text-ink-soft transition hover:border-moss hover:text-ink"
          >
            Import a list
          </button>
        </div>
      </div>

      {filter && data && (
        <p className="-mt-4 mb-6 font-hand text-lg text-ink-soft" aria-live="polite">
          {entries.length === 0
            ? 'Nothing on your shelves matches that.'
            : `${entries.length} of ${total} books match. Dragging pauses while you filter.`}
        </p>
      )}

      {isPending ? (
        <BookcaseSkeleton />
      ) : isError ? (
        <div className="rounded-2xl border border-line p-10 text-center">
          <p className="font-hand text-xl text-ink-soft">{error.message}</p>
          <button type="button" onClick={() => void refetch()} className="mt-4 rounded-full bg-moss px-4 py-2 text-on-moss">
            Try again
          </button>
        </div>
      ) : (
        <>
          {total === 0 && <FirstVisit onImport={() => setImportOpen(true)} onSearch={() => findBook('want_to_read')} />}
          <Bookcase
            entries={entries}
            openId={openEntry?.id ?? null}
            filtered={terms.length > 0}
            onOpen={(entry) => void navigate({ to: '/library/$entryId', params: { entryId: entry.id } })}
            onFindBook={(shelf) => findBook(shelf)}
          />
        </>
      )}

      <SearchDialog
        key={searchSeed.key}
        initialQuery={searchSeed.query}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        shelf={searchShelf}
        onShelfChange={setSearchShelf}
      />
      <ImportDialog user={user} open={importOpen} onOpenChange={setImportOpen} onFind={(query) => findBook('want_to_read', query)} />
      <ImportPill onOpen={() => setImportOpen(true)} />
      <AnimatePresence>
        {openEntry && (
          <BookDetail
            key={openEntry.id}
            entry={openEntry}
            onClose={() => void navigate({ to: '/library', resetScroll: false })}
            onSearch={(query) => findBook("want_to_read", query)}
          />
        )}
      </AnimatePresence>
    </AppShell>
  )
}

function FirstVisit({ onImport, onSearch }: { onImport: () => void; onSearch: () => void }) {
  return (
    <div className="mb-12 flex flex-col items-start gap-4 rounded-[1.75rem] border border-line bg-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div>
        <h2 className="font-display text-2xl font-medium">Your library is ready for its first book</h2>
        <p className="mt-1 font-hand text-xl text-ink-soft">Bring a whole list over, or start with the one in your bag.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onSearch} className="rounded-full bg-moss px-5 py-2.5 font-medium text-on-moss">
          Find a book
        </button>
        <button type="button" onClick={onImport} className="rounded-full border border-line-strong px-5 py-2.5 font-medium hover:border-moss">
          Import a list
        </button>
      </div>
    </div>
  )
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 5) return 'Reading late'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
