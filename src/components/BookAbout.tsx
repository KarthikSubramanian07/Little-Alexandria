// The parts of a book's card that come from the open catalogues: how long it
// takes, what other readers make of it, how it opens, what's in the story, who
// wrote it, and where to read more. Each part appears only when there is
// something to say, and nothing here is the reader's own data.
import { clsx } from 'clsx'
import { useState, type ReactNode } from 'react'
import type { BookAbout, Shelf } from '../../shared/types'

const count = (value: number) => value.toLocaleString()

/** Open Library readers' verdict, in three big numbers. */
export function ReadersVerdict({ about, shelf }: { about: BookAbout; shelf: Shelf }) {
  const { community, readingMinutes } = about
  if (!community) return null
  const stats: { value: ReactNode; label: string }[] = []
  if (community.rating !== null) {
    stats.push({
      value: (
        <>
          {community.rating.toFixed(1)}
          <span aria-hidden className="ml-0.5 text-[0.7em] text-marigold">
            ★
          </span>
        </>
      ),
      label: `average from ${count(community.ratings)} ratings`,
    })
  }
  if (community.wantToRead > 0) {
    stats.push({ value: count(community.wantToRead), label: 'want to read it' })
  }
  if (community.read > 0) stats.push({ value: count(community.read), label: 'have finished it' })
  if (stats.length === 0) return null

  // On the someday pile, the question is "is it worth it?": answer it in a line.
  const hours = readingMinutes ? Math.round(readingMinutes / 60) : null
  const nudge =
    shelf === 'want_to_read' && hours !== null && hours > 0
      ? `a ${hours}-hour read${community.wantToRead > 0 ? `, on the wish lists of ${count(community.wantToRead)} Open Library readers` : ''}`
      : null

  return (
    <section aria-labelledby="verdict-heading" className="mt-6">
      <h3 id="verdict-heading" className="sr-only">
        What Open Library readers think
      </h3>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col-reverse rounded-2xl border border-line bg-paper/60 px-4 py-3"
          >
            <dt className="mt-1.5 text-xs leading-snug text-ink-faint">{stat.label}</dt>
            <dd className="font-display text-[1.7rem] leading-none font-medium tracking-tight text-ink tabular-nums">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
      {nudge && <p className="mt-3 font-hand text-lg text-moss">{nudge}</p>}
    </section>
  )
}

/** The book's first lines, set like a quotation. */
export function OpeningLines({ text }: { text: string }) {
  return (
    <section aria-labelledby="opening-heading" className="mt-8">
      <h3 id="opening-heading" className="font-hand text-xl text-ink-soft">
        It begins…
      </h3>
      <blockquote className="relative mt-2 border-l-2 border-marigold/70 pl-5">
        <p className="font-display text-[1.15rem] leading-relaxed text-ink/90 italic">{text}</p>
      </blockquote>
    </section>
  )
}

function Chips({ items, tone = 'plain' }: { items: string[]; tone?: 'plain' | 'moss' }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className={clsx(
            'rounded-full px-2.5 py-0.5 text-sm',
            tone === 'moss' ? 'bg-moss-soft text-moss' : 'border border-line text-ink-soft',
          )}
        >
          {item}
        </li>
      ))}
    </ul>
  )
}

/** Where and when it happens, who is in it, and what it's about. */
export function InTheStory({ story }: { story: BookAbout['story'] }) {
  const rows = [
    { label: 'Set in', items: story.places },
    { label: 'When', items: story.times },
    { label: 'Characters', items: story.characters },
    { label: 'Themes', items: story.themes, tone: 'moss' as const },
  ].filter((row) => row.items.length > 0)
  if (rows.length === 0) return null
  return (
    <section aria-labelledby="story-heading" className="mt-8">
      <h3 id="story-heading" className="font-hand text-xl text-ink-soft">
        In the story
      </h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-[7rem_1fr] sm:gap-x-4">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="pt-0.5 text-sm text-ink-faint">{row.label}</dt>
            <dd className="-mt-1.5 sm:mt-0">
              <Chips items={row.items} tone={row.tone} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function ExternalLink({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={clsx(
        'underline decoration-line-strong underline-offset-4 transition hover:text-ink hover:decoration-moss',
        className,
      )}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

/** The author: a portrait, their dates, and a short biography with its source. */
export function AboutAuthor({ author }: { author: NonNullable<BookAbout['author']> }) {
  const [open, setOpen] = useState(false)
  const [photoFailed, setPhotoFailed] = useState(false)
  const long = (author.bio?.length ?? 0) > 320
  const dates = author.born
    ? author.died
      ? `${author.born} – ${author.died}`
      : `born ${author.born}`
    : null
  return (
    <section aria-labelledby="author-heading" className="mt-8">
      <h3 id="author-heading" className="font-hand text-xl text-ink-soft">
        About the author
      </h3>
      <div className="mt-3 flex gap-4">
        {author.photoUrl && !photoFailed && (
          <img
            src={author.photoUrl}
            alt={`Portrait of ${author.name}`}
            loading="lazy"
            decoding="async"
            onError={() => setPhotoFailed(true)}
            className="size-20 shrink-0 rounded-2xl object-cover shadow-[3px_6px_14px_-8px_rgb(var(--shadow-rgb)/0.7)] sm:size-24"
          />
        )}
        <div className="min-w-0">
          <p className="font-display text-xl leading-tight text-ink">{author.name}</p>
          {dates && <p className="mt-0.5 text-sm text-ink-faint">{dates}</p>}
          {author.bio && (
            <>
              <p
                className={clsx(
                  'mt-2 leading-relaxed text-ink-soft',
                  !open && long && 'line-clamp-4',
                )}
              >
                {author.bio}
              </p>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                {long && (
                  <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    aria-expanded={open}
                    className="font-medium text-moss underline-offset-4 hover:underline"
                  >
                    {open ? 'Show less' : 'Read more'}
                  </button>
                )}
                {author.bioSource && (
                  <span className="text-ink-faint">
                    Biography from{' '}
                    <ExternalLink href={author.bioSource.url}>{author.bioSource.name}</ExternalLink>
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

/** Reviews and reference pages about the book. */
export function FurtherReading({ links }: { links: BookAbout['links'] }) {
  if (links.length === 0) return null
  return (
    <section aria-labelledby="further-heading" className="mt-8">
      <h3 id="further-heading" className="font-hand text-xl text-ink-soft">
        Further reading
      </h3>
      <ul className="mt-2 space-y-1.5">
        {links.map((link) => (
          <li key={link.url} className="flex gap-2 leading-snug text-ink-soft">
            <span aria-hidden className="font-hand text-moss">
              ~
            </span>
            <ExternalLink href={link.url}>{link.title}</ExternalLink>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Where the catalogue details came from, as Open Library asks. */
export function SourcesNote({ url }: { url: string }) {
  return (
    <p className="mt-6 text-xs text-ink-faint">
      Ratings, reading logs, and story details from{' '}
      <ExternalLink href={url}>Open Library</ExternalLink>, the free, open catalogue of books.
    </p>
  )
}

/** Placeholders while the catalogues answer, shaped like what's coming. */
export function AboutSkeleton() {
  return (
    <div aria-hidden className="mt-6 grid grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[4.6rem] animate-pulse rounded-2xl bg-line/40" />
      ))}
    </div>
  )
}
