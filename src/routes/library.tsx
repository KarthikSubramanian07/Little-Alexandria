import { createFileRoute, redirect, useNavigate, useParams } from '@tanstack/react-router'
import { AnimatePresence } from 'motion/react'
import { useState } from 'react'
import type { Shelf } from '../../shared/types'
import { AppShell } from '../components/AppShell'
import { BookDetail } from '../components/BookDetail'
import { Bookcase, BookcaseSkeleton } from '../components/Bookcase'
import { SearchDialog } from '../components/SearchDialog'
import { libraryQuery, meQuery, useLibrary, useMe } from '../lib/queries'

export const Route = createFileRoute('/library')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(meQuery).catch(() => null)
    if (!user) throw redirect({ to: '/', search: { next: location.href } as never })
    return { user }
  },
  loader: ({ context }) => void context.queryClient.prefetchQuery(libraryQuery),
  component: LibraryPage,
  head: () => ({ meta: [{ title: 'Your shelves · Little Alexandria' }] }),
})

function LibraryPage() {
  const { data: user } = useMe()
  const { data, isPending, isError, error, refetch } = useLibrary()
  const navigate = useNavigate()
  const { entryId } = useParams({ strict: false })
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchShelf, setSearchShelf] = useState<Shelf>('want_to_read')
  const openEntry = data?.entries.find((entry) => entry.id === entryId) ?? null

  const findBook = (shelf: Shelf = 'want_to_read') => {
    setSearchShelf(shelf)
    setSearchOpen(true)
  }

  if (!user) return null
  return (
    <AppShell user={user} onSearch={() => findBook(searchShelf)}>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-hand text-xl text-moss">{greeting()}, {user.name.split(' ')[0]}</p>
          <h1 className="font-display text-[clamp(2.2rem,5vw,3.4rem)] leading-none font-medium tracking-tight">Your shelves</h1>
        </div>
        {data && data.entries.length > 0 && (
          <p className="font-hand text-lg text-ink-faint">
            {data.entries.length} {data.entries.length === 1 ? 'book' : 'books'}, drag them anywhere
          </p>
        )}
      </div>

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
        <Bookcase entries={data.entries} openId={openEntry?.id ?? null} onFindBook={findBook} />
      )}

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} shelf={searchShelf} onShelfChange={setSearchShelf} />
      <AnimatePresence>
        {openEntry && (
          <BookDetail key={openEntry.id} entry={openEntry} onClose={() => void navigate({ to: '/library', resetScroll: false })} />
        )}
      </AnimatePresence>
    </AppShell>
  )
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 5) return 'Reading late'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
