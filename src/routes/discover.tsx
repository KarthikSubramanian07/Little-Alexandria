import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { AppShell } from '../components/AppShell'
import { PotWithSprout } from '../components/art/scenes'
import { MiniShelf } from '../components/Related'
import { api } from '../lib/api'
import { meQuery, useMe } from '../lib/queries'

export const Route = createFileRoute('/discover')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQuery).catch(() => null)
    if (!user) throw redirect({ to: '/' })
  },
  component: DiscoverPage,
})

function DiscoverPage() {
  const { data: user } = useMe()
  const discover = useQuery({ queryKey: ['discover'], queryFn: api.discover, staleTime: 15 * 60_000 })
  if (!user) return null
  return (
    <AppShell user={user}>
      <p className="font-hand text-xl text-moss">picked from your own shelves</p>
      <h1 className="font-display text-[clamp(2.2rem,5vw,3.4rem)] leading-none font-medium tracking-tight">Discover</h1>
      <p className="mt-3 max-w-xl text-ink-soft">
        No algorithm in a lab coat. These come from the authors you rated highest and the genres you actually read.
      </p>

      {discover.isPending ? (
        <div className="mt-10 space-y-10" aria-busy aria-label="Finding books for you">
          {[0, 1].map((row) => (
            <div key={row}>
              <div className="h-6 w-64 animate-pulse rounded bg-line" />
              <div className="mt-4 flex gap-4">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="aspect-[2/3] w-28 animate-pulse rounded bg-line/70 sm:w-32" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : discover.data && discover.data.sections.length > 0 ? (
        discover.data.sections.map((section) => <MiniShelf key={section.title} title={section.title} books={section.books} />)
      ) : (
        <div className="mt-12 flex flex-col items-center gap-4 rounded-[1.75rem] border border-dashed border-line-strong px-6 py-14 text-center">
          <div className="size-28">
            <PotWithSprout />
          </div>
          <p className="max-w-md font-hand text-xl text-ink-soft">
            Rate a few books you’ve finished (four stars or more) and we’ll find you more like them.
          </p>
          <Link to="/library" className="rounded-full bg-moss px-5 py-2.5 font-medium text-on-moss">
            Go rate something
          </Link>
        </div>
      )}
    </AppShell>
  )
}
