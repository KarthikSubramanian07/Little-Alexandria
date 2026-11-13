import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { z } from 'zod'
import type { LibraryEntry, SearchResult } from '../../shared/types'
import { Fireflies } from '../components/art/scenes'
import { ThemeToggle } from '../components/AppShell'
import { BookDetail } from '../components/BookDetail'
import { Bookcase, BookcaseSkeleton } from '../components/Bookcase'
import { GardenBed } from '../components/Garden'
import { Wordmark } from '../components/Wordmark'
import { api, ApiError } from '../lib/api'
import { meQuery, useAddBook, useLibrary, useMe } from '../lib/queries'

export const Route = createFileRoute('/u/$handle')({
  validateSearch: z.object({ book: z.string().optional() }),
  loader: ({ context }) => void context.queryClient.prefetchQuery(meQuery),
  component: SharedLibraryPage,
})

const asResult = (entry: LibraryEntry): SearchResult => ({
  source: entry.book.source,
  sourceId: entry.book.sourceId,
  title: entry.book.title,
  authors: entry.book.authors,
  publishedYear: entry.book.publishedYear,
  pageCount: entry.book.pageCount,
  thumbnailUrl: entry.book.coverUrl,
})

function SharedLibraryPage() {
  const { handle } = Route.useParams()
  const { book: openId } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: me } = useMe()
  const shared = useQuery({
    queryKey: ['shared', handle],
    queryFn: () => api.shared(handle),
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  })
  const year = new Date().getFullYear()
  const openEntry = shared.data?.entries.find((entry) => entry.id === openId) ?? null
  const isOwner = me?.handle === handle
  const first = shared.data?.profile.name.split(' ')[0] ?? ''

  if (shared.isError) {
    return (
      <Shell>
        <div className="mx-auto max-w-md py-24 text-center">
          <h1 className="font-display text-4xl font-medium">This library is closed</h1>
          <p className="mt-3 font-hand text-xl text-ink-soft">
            Either nobody lives at /u/{handle}, or its reader keeps their shelves to themselves.
          </p>
          <Link to="/" className="mt-8 inline-block rounded-full bg-moss px-5 py-2.5 font-medium text-on-moss">
            Start your own library
          </Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      {shared.data ? (
        <>
          <header className="flex flex-wrap items-end justify-between gap-6 pt-4 pb-10">
            <div className="flex items-center gap-4">
              <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-line-strong bg-moss-soft font-display text-2xl text-moss">
                {shared.data.profile.avatarUrl ? (
                  <img src={shared.data.profile.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                ) : (
                  first.slice(0, 1)
                )}
              </div>
              <div>
                <p className="font-hand text-xl text-moss">a library by</p>
                <h1 className="font-display text-[clamp(2rem,5vw,3.2rem)] leading-none font-medium tracking-tight">
                  {shared.data.profile.name}
                </h1>
              </div>
            </div>
            <p className="font-hand text-xl text-ink-soft">
              {shared.data.entries.length.toLocaleString()} {shared.data.entries.length === 1 ? 'book' : 'books'} ·{' '}
              {shared.data.stats.booksRead} finished in {year}
            </p>
          </header>

          {!me && <Invitation name={first} />}
          {isOwner && (
            <p className="mb-8 rounded-2xl border border-dashed border-line-strong px-5 py-3 font-hand text-lg text-ink-soft">
              This is how visitors see your library. Your notes stay hidden.{' '}
              <Link to="/library" className="text-moss underline underline-offset-4">
                Back to your shelves
              </Link>
            </p>
          )}

          <Bookcase
            entries={shared.data.entries}
            openId={openEntry?.id ?? null}
            readOnly
            onOpen={(entry) => void navigate({ search: { book: entry.id }, resetScroll: false })}
          />

          <section className="mt-16">
            <h2 className="mb-4 font-display text-2xl font-medium">{first}’s reading garden, {year}</h2>
            <GardenBed entries={shared.data.entries.filter((entry) => entry.shelf === 'read' && entry.finishedAt?.startsWith(String(year)))} year={year} />
          </section>

          {!me && (
            <section className="relative mt-16 overflow-hidden rounded-[1.75rem] border border-line bg-card px-6 py-14 text-center">
              <Fireflies count={8} />
              <h2 className="font-display text-3xl font-medium text-balance">Every great reader deserves a great library.</h2>
              <p className="mt-2 font-hand text-xl text-ink-soft">Yours is one click away. Free, private until you share it.</p>
              <div className="mt-6 flex justify-center">
                <SignInButton next={`/u/${handle}`} />
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="pt-24">
          <BookcaseSkeleton />
        </div>
      )}

      <AnimatePresence>
        {openEntry && shared.data && (
          <BookDetail
            key={openEntry.id}
            entry={openEntry}
            onClose={() => void navigate({ search: {}, resetScroll: false })}
            visitor={{
              ownerName: shared.data.profile.name,
              action: me ? <ShelveForMe entry={openEntry} /> : <SignInButton next={`/u/${handle}?book=${openEntry.id}`} label="Start your library with this book" />,
            }}
          />
        )}
      </AnimatePresence>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-4 pb-24 sm:px-8">
      <header className="flex items-center justify-between py-5">
        <Link to="/" aria-label="Little Alexandria home">
          <Wordmark />
        </Link>
        <ThemeToggle />
      </header>
      <main>{children}</main>
    </div>
  )
}

function Invitation({ name }: { name: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="mb-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-card px-5 py-4 sm:flex-row sm:items-center"
    >
      <p className="font-hand text-xl text-ink-soft">
        Browsing {name}’s shelves? Make your own; tap any book to start with it.
      </p>
      <SignInButton next="/library" compact />
    </motion.div>
  )
}

function SignInButton({ next, label = 'Start your own library', compact }: { next: string; label?: string; compact?: boolean }) {
  return (
    <a
      href={`/api/auth/google?next=${encodeURIComponent(next)}`}
      className={
        compact
          ? 'shrink-0 rounded-full bg-moss px-4 py-2 text-sm font-medium text-on-moss transition hover:brightness-110'
          : 'inline-flex items-center gap-2 rounded-full bg-moss px-6 py-3 font-medium text-on-moss shadow-[0_10px_24px_-12px_var(--moss)] transition hover:brightness-110 active:scale-[0.98]'
      }
    >
      {label} <span aria-hidden>→</span>
    </a>
  )
}

function ShelveForMe({ entry }: { entry: LibraryEntry }) {
  const add = useAddBook()
  const { data } = useLibrary()
  const owned = data?.entries.find((mine) => mine.book.id === entry.book.id)
  if (owned) {
    return (
      <Link to="/library/$entryId" params={{ entryId: owned.id }} className="inline-flex rounded-full bg-moss-soft px-4 py-2 text-sm font-medium text-moss">
        ✓ Already on your shelves
      </Link>
    )
  }
  return (
    <button
      type="button"
      disabled={add.isPending}
      onClick={() => add.mutate({ result: asResult(entry), shelf: 'want_to_read' })}
      className="rounded-full bg-moss px-5 py-2.5 text-sm font-medium text-on-moss transition hover:brightness-110 disabled:opacity-60"
    >
      {add.isPending ? 'Shelving…' : 'Add to my Want to Read'}
    </button>
  )
}
