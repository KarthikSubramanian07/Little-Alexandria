import { clsx } from 'clsx'
import { animate, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { LibraryEntry, ReadingStats } from '../../shared/types'
import { bloomColor, fallbackSpine } from '../lib/color'
import { useSetGoal } from '../lib/queries'
import { Flower } from './art/Flower'
import { CRAYON } from './art/palette'
import { Fireflies, GoalSun, SeedBed } from './art/scenes'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const wholeNumber = (n: number) => Math.round(n).toLocaleString()

function AnimatedNumber({ value, format = wholeNumber }: { value: number; format?: (n: number) => string }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const last = useRef(0)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (reduce) {
      node.textContent = format(value)
      return
    }
    const controls = animate(last.current, value, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        node.textContent = format(latest)
      },
    })
    last.current = value
    return () => controls.stop()
  }, [value, reduce, format])
  return <span ref={ref}>{format(reduce ? value : 0)}</span>
}

/** Flower height follows page count on a gentle log scale: tomes stand tall. */
const stemFor = (pages: number | null) => Math.round(54 + Math.min(1, Math.log10(Math.max(pages ?? 250, 60)) / 3.1) * 70)

export function GardenBed({ entries, year }: { entries: LibraryEntry[]; year: number }) {
  const [focused, setFocused] = useState<string | null>(null)
  const sorted = [...entries].sort((a, b) => (a.finishedAt ?? '').localeCompare(b.finishedAt ?? ''))
  if (sorted.length === 0) {
    return (
      <div className="relative flex flex-col items-center gap-3 rounded-[1.75rem] border border-dashed border-line-strong px-6 py-12 text-center">
        <div className="h-28 w-36">
          <SeedBed />
        </div>
        <p className="max-w-sm font-hand text-xl text-ink-soft">
          Nothing in bloom for {year} yet. Finish a book and the first flower comes up here.
        </p>
      </div>
    )
  }
  const active = sorted.find((entry) => entry.id === focused)
  return (
    <figure className="relative overflow-hidden rounded-[1.75rem] border border-line bg-[linear-gradient(180deg,var(--sky),transparent_70%)] px-4 pt-12 pb-0 sm:px-8">
      <Fireflies />
      <figcaption className="absolute top-4 left-5 font-hand text-lg text-ink-soft sm:left-8">
        {active ? (
          <>
            <span className="font-display text-base text-ink italic">{active.book.title}</span>
            <span className="text-ink-faint"> · bloomed {active.finishedAt}</span>
          </>
        ) : (
          'one flower for every book you finished'
        )}
      </figcaption>
      <ul className="relative flex min-h-[230px] flex-wrap items-end justify-center gap-x-1 gap-y-0" aria-label={`Books finished in ${year}`}>
        {sorted.map((entry, i) => (
          <li key={entry.id} className="-mx-1 w-14 sm:w-[4.5rem]">
            <button
              type="button"
              className="block w-full origin-bottom transition-transform hover:-translate-y-1 focus-visible:-translate-y-1"
              onMouseEnter={() => setFocused(entry.id)}
              onMouseLeave={() => setFocused(null)}
              onFocus={() => setFocused(entry.id)}
              onBlur={() => setFocused(null)}
              aria-label={`${entry.book.title}, finished ${entry.finishedAt}`}
            >
              <Flower
                color={bloomColor(entry.book.spineColor ?? fallbackSpine(entry.book.title))}
                height={stemFor(entry.book.pageCount)}
                seed={entry.id}
                delay={0.15 + i * 0.09}
                className="h-auto w-full"
              />
            </button>
          </li>
        ))}
      </ul>
      <GrassTufts />
      {/* The ground line, drawn by hand. */}
      <svg viewBox="0 0 600 24" preserveAspectRatio="none" className="-mx-8 block h-6 w-[calc(100%+4rem)]" aria-hidden>
        <path d="M0 10 C 80 4, 160 14, 250 8 S 420 4, 600 10 L 600 24 L 0 24 Z" fill={CRAYON.soil} opacity={0.85} filter="url(#la-crayon)" />
        <path d="M0 10 C 80 4, 160 14, 250 8 S 420 4, 600 10" fill="none" stroke={CRAYON.ink} strokeWidth="1.6" strokeOpacity="0.5" filter="url(#la-wobble)" />
      </svg>
    </figure>
  )
}

export function GoalPanel({ stats }: { stats: ReadingStats }) {
  const setGoal = useSetGoal()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(stats.goal ?? 12))
  const progress = stats.goal ? stats.booksRead / stats.goal : 0
  const left = stats.goal ? Math.max(0, stats.goal - stats.booksRead) : null

  const save = () => {
    const target = Number(draft)
    if (Number.isInteger(target) && target >= 1 && target <= 1000) {
      setGoal.mutate({ year: stats.year, target })
      setEditing(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 rounded-[1.75rem] border border-line bg-card p-6 sm:flex-row sm:p-8">
      <div className="relative shrink-0">
        <GoalSun progress={progress} size={176} />
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-4xl leading-none font-semibold text-[#3a2a20]">
              <AnimatedNumber value={stats.booksRead} />
            </p>
            <p className="mt-1 font-hand text-base text-[#5b4a3c]">{stats.goal ? `of ${stats.goal}` : 'books'}</p>
          </div>
        </div>
      </div>
      <div className="text-center sm:text-left">
        <h2 className="font-display text-2xl font-medium tracking-tight">{stats.year} reading goal</h2>
        {editing ? (
          <form
            className="mt-3 flex items-center justify-center gap-2 sm:justify-start"
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            <label className="sr-only" htmlFor="goal-input">Books to read in {stats.year}</label>
            <input
              id="goal-input"
              type="number"
              min={1}
              max={1000}
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="w-24 rounded-xl border border-line-control bg-paper px-3 py-2 font-mono text-lg focus:border-moss"
            />
            <span className="font-hand text-lg text-ink-soft">books</span>
            <button type="submit" className="rounded-full bg-moss px-4 py-2 text-sm font-medium text-on-moss active:scale-95">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="px-2 text-sm text-ink-faint hover:text-ink">
              Cancel
            </button>
          </form>
        ) : (
          <>
            <p className="mt-2 max-w-md font-hand text-xl leading-snug text-ink-soft">
              {stats.goal === null
                ? 'No goal yet. Pick a number that feels like a treat, not a chore.'
                : left === 0
                  ? `Goal met. Every book from here is a bonus bloom.`
                  : `${left} more ${left === 1 ? 'book' : 'books'} and the sun is all the way up.`}
            </p>
            <button
              type="button"
              onClick={() => {
                setDraft(String(stats.goal ?? 12))
                setEditing(true)
              }}
              className="mt-4 rounded-full border border-line-strong px-4 py-1.5 text-sm font-medium transition hover:border-moss hover:bg-moss hover:text-on-moss"
            >
              {stats.goal === null ? 'Set a goal' : 'Change goal'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const oneDecimal = (n: number) => (n === 0 ? '·' : n.toFixed(1))

export function StatTiles({ stats }: { stats: ReadingStats }) {
  const tiles = [
    { label: 'Books finished', value: stats.booksRead, note: `in ${stats.year}` },
    { label: 'Pages turned', value: stats.pagesRead, note: stats.pagesRead > 0 ? `about ${Math.round(stats.pagesRead / 300)} doorstops` : 'the first is the hardest' },
    { label: 'Average rating', value: stats.averageRating ?? 0, note: stats.averageRating ? 'out of five' : 'rate a book to see it', decimals: true },
    { label: 'On the nightstand', value: stats.currentlyReading, note: stats.currentlyReading === 1 ? 'book in progress' : 'books in progress' },
  ]
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile, i) => (
        <motion.div
          key={tile.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.06 }}
          className="rounded-2xl border border-line bg-card px-5 py-4"
        >
          <dt className="text-sm text-ink-soft">{tile.label}</dt>
          <dd className="mt-1 font-display text-4xl font-medium tracking-tight tabular-nums">
            <AnimatedNumber value={tile.value} format={tile.decimals ? oneDecimal : undefined} />
          </dd>
          <dd className="font-hand text-base text-ink-faint">{tile.note}</dd>
        </motion.div>
      ))}
    </dl>
  )
}

/** Books per month, drawn as little stems with a leaf for each book. */
export function MonthStrip({ stats }: { stats: ReadingStats }) {
  const max = Math.max(1, ...stats.byMonth)
  const thisMonth = new Date().getFullYear() === stats.year ? new Date().getMonth() : -1
  return (
    <div className="rounded-[1.75rem] border border-line bg-card p-6">
      <h3 className="font-display text-xl font-medium">Month by month</h3>
      <ol className="mt-5 grid grid-cols-12 items-end gap-1.5 sm:gap-3" aria-label="Books finished each month">
        {stats.byMonth.map((count, month) => (
          <li key={month} className="flex flex-col items-center gap-2" aria-label={`${MONTHS[month]}: ${count} ${count === 1 ? 'book' : 'books'}`}>
            <div className="flex h-28 w-full items-end justify-center">
              <motion.div
                className={clsx('w-2 rounded-full sm:w-2.5', count ? 'bg-moss' : 'bg-line')}
                initial={{ height: 4 }}
                animate={{ height: count ? `${Math.max(12, (count / max) * 100)}%` : 4 }}
                transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.2 + month * 0.04 }}
              />
            </div>
            <span className={clsx('h-3.5 font-mono text-[11px] leading-3.5 uppercase', month === thisMonth ? 'text-ink' : 'text-ink-faint')}>
              {MONTHS[month]!.slice(0, 1)}
              <span className="hidden sm:inline">{MONTHS[month]!.slice(1)}</span>
            </span>
            <span className="h-3.5 font-mono text-[11px] leading-3.5 text-ink-soft tabular-nums">{count || ''}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function GenreVines({ stats }: { stats: ReadingStats }) {
  const max = Math.max(1, ...stats.topGenres.map((genre) => genre.count))
  return (
    <div className="rounded-[1.75rem] border border-line bg-card p-6">
      <h3 className="font-display text-xl font-medium">Favourite genres</h3>
      <p className="font-hand text-base text-ink-faint">books you loved count twice</p>
      {stats.topGenres.length === 0 ? (
        <p className="mt-6 font-hand text-lg text-ink-soft">Read a few books and your tastes will start to show.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {stats.topGenres.map((genre, i) => (
            <li key={genre.genre}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{genre.genre}</span>
                <span className="font-mono text-xs text-ink-faint">{genre.count}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper-deep">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: [CRAYON.moss, CRAYON.rose, CRAYON.marigold, CRAYON.sky, CRAYON.lilac][i % 5] }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(genre.count / max) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 90, damping: 18, delay: 0.25 + i * 0.08 }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** A few hand-drawn tufts of grass along the bed, so the garden never looks bare. */
function GrassTufts() {
  const spots = [4, 13, 27, 38, 52, 63, 71, 84, 93]
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-5 h-6">
      {spots.map((left, i) => (
        <svg key={left} viewBox="0 0 24 16" className="absolute bottom-0 w-6" style={{ left: `${left}%`, transform: `scaleX(${i % 2 ? -1 : 1})` }}>
          <path
            d="M3 16 C 4 10, 3 6, 1 2 M9 16 C 9 9, 11 6, 13 1 M15 16 C 15 11, 18 8, 22 6"
            fill="none"
            stroke={CRAYON.leaf}
            strokeWidth="1.8"
            strokeLinecap="round"
            filter="url(#la-wobble)"
          />
        </svg>
      ))}
    </div>
  )
}
