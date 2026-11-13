import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { AppShell } from '../components/AppShell'
import { GardenBed, GenreVines, GoalPanel, MonthStrip, StatTiles } from '../components/Garden'
import { libraryQuery, meQuery, statsQuery, useLibrary, useMe } from '../lib/queries'

const thisYear = new Date().getFullYear()

export const Route = createFileRoute('/garden')({
  validateSearch: z.object({ year: z.number().int().min(1900).max(3000).optional() }),
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQuery).catch(() => null)
    if (!user) throw redirect({ to: '/' })
  },
  loaderDeps: ({ search }) => ({ year: search.year ?? thisYear }),
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(statsQuery(deps.year))
    void context.queryClient.prefetchQuery(libraryQuery)
  },
  component: GardenPage,
})

function GardenPage() {
  const { data: user } = useMe()
  const year = Route.useSearch().year ?? thisYear
  const stats = useQuery(statsQuery(year))
  const { data: library } = useLibrary()
  const finished = (library?.entries ?? []).filter((entry) => entry.shelf === 'read' && entry.finishedAt?.startsWith(String(year)))

  if (!user) return null
  return (
    <AppShell user={user}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-hand text-xl text-moss">what you’ve grown</p>
          <h1 className="font-display text-[clamp(2.2rem,5vw,3.4rem)] leading-none font-medium tracking-tight">
            Your reading garden
          </h1>
        </div>
        <nav aria-label="Year" className="flex items-center gap-1 rounded-full border border-line p-1 font-mono text-sm">
          <Link to="/garden" search={{ year: year - 1 }} className="rounded-full px-3 py-1 text-ink-soft hover:bg-paper-deep hover:text-ink" aria-label={`Show ${year - 1}`}>
            ←
          </Link>
          <span className="px-2 tabular-nums">{year}</span>
          <Link
            to="/garden"
            search={{ year: year + 1 }}
            disabled={year >= thisYear}
            className="rounded-full px-3 py-1 text-ink-soft hover:bg-paper-deep hover:text-ink aria-disabled:pointer-events-none aria-disabled:opacity-30"
            aria-label={`Show ${year + 1}`}
          >
            →
          </Link>
        </nav>
      </div>

      {stats.data ? (
        <div className="flex flex-col gap-5">
          <GardenBed entries={finished} year={year} />
          <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
            <GoalPanel key={`${year}-${stats.data.goal}`} stats={stats.data} />
            <GenreVines stats={stats.data} />
          </div>
          <StatTiles stats={stats.data} />
          <MonthStrip stats={stats.data} />
        </div>
      ) : (
        <div className="h-96 animate-pulse rounded-[1.75rem] bg-line/50" aria-busy aria-label="Loading your garden" />
      )}
    </AppShell>
  )
}
