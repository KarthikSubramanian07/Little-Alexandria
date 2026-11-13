import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Dialog } from 'radix-ui'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SHELF_LABELS, SHELVES, type LibraryEntry } from '../../shared/types'
import { api } from '../lib/api'
import { gentle, settle, snappy } from '../lib/motion'
import { useMoveEntry, useRemoveEntry, useUpdateEntry } from '../lib/queries'
import { Cover } from './Book'
import { RelatedShelves } from './Related'
import { StarRating } from './StarRating'

/** A library call number, of sorts: genre, the author's first three letters, the year. */
function callNumber(entry: LibraryEntry) {
  const genre = (entry.book.genres[0] ?? 'General').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
  const author = (entry.book.authors[0] ?? '').split(' ').at(-1) ?? ''
  return [genre, author.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'ANON', entry.book.publishedYear ?? '']
    .filter(Boolean)
    .join(' · ')
}

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** "13 Nov 2026", or just "2025" when an imported list only knew the year. */
const finishedLabel = (entry: LibraryEntry) =>
  entry.finishedAt ? (entry.finishedApprox ? entry.finishedAt.slice(0, 4) : formatDate(entry.finishedAt)) : null

interface BookDetailProps {
  entry: LibraryEntry
  onClose: () => void
  /** Visitors on a shared page see the book but can't edit it. */
  visitor?: { ownerName: string; action: ReactNode }
  /** Open search, pre-filled, from the related shelves. */
  onSearch?: (query: string) => void
}

export function BookDetail({ entry, onClose, visitor, onSearch }: BookDetailProps) {
  const reduce = useReducedMotion()
  const card = useRef<HTMLElement>(null)
  const { book } = entry
  // Books that arrived through an import may not have a description yet; the
  // related call fetches and saves one, so ask for it here too.
  const related = useQuery({
    queryKey: ['related', entry.id],
    queryFn: () => api.related(entry.id),
    enabled: !visitor,
    staleTime: 10 * 60_000,
  })
  const description = book.description ?? related.data?.description ?? null

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal forceMount>
        <Dialog.Overlay forceMount asChild>
          <motion.div
            className="fixed inset-0 z-40 bg-[rgb(var(--shadow-rgb)/0.42)] backdrop-blur-[4px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
          />
        </Dialog.Overlay>
        <Dialog.Content
          forceMount
          aria-describedby={undefined}
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain focus:outline-none"
          onPointerDownOutside={(event) => event.preventDefault()}
          // Land focus on the card itself, not the close button, so nothing lights up uninvited.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            card.current?.focus({ preventScroll: true })
          }}
        >
          {/* Clicking the dim margins closes the card, like setting a book down. */}
          <div className="flex min-h-full items-start justify-center px-3 py-6 sm:px-6 sm:py-12" onClick={onClose}>
            <motion.article
              ref={card}
              tabIndex={-1}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-5xl outline-none rounded-[1.75rem] border border-line bg-card p-5 shadow-[0_50px_100px_-40px_rgb(var(--shadow-rgb)/0.7)] sm:p-9"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.98, transition: { duration: 0.22 } }}
              transition={gentle}
            >
              <Dialog.Close
                aria-label="Back to the shelves"
                className="absolute top-4 right-4 z-10 grid size-10 place-items-center rounded-full text-ink-soft transition hover:bg-paper-deep hover:text-ink active:scale-90"
              >
                <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                  <path d="M5 5 L15 15 M15 5 L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </Dialog.Close>

              <div className="grid gap-8 md:grid-cols-[auto_1fr] md:gap-12">
                {/* The cover, which flew here from the shelf. */}
                <div className="flex flex-col items-center gap-5 md:pt-2">
                  <motion.div layoutId={`cover-${entry.id}`} transition={settle} className="relative" style={{ perspective: 1200 }}>
                    <Cover book={book} entryId={visitor ? undefined : entry.id} size="lg" tilt={-10} />
                    <AnimatePresence>
                      {entry.shelf === 'read' && entry.finishedAt && <FinishedStamp label={finishedLabel(entry)!} />}
                    </AnimatePresence>
                  </motion.div>
                  <p className="font-mono text-[11px] tracking-[0.18em] text-ink-faint">{callNumber(entry)}</p>
                </div>

                <div className="min-w-0">
                  <Dialog.Title className="pr-10 font-display text-3xl leading-[1.05] font-medium tracking-tight text-balance sm:text-[2.6rem]">
                    {book.title}
                  </Dialog.Title>
                  {book.subtitle && <p className="mt-2 font-display text-lg text-ink-soft italic">{book.subtitle}</p>}
                  <p className="mt-3 text-lg text-ink-soft">{book.authors.join(', ') || 'Unknown author'}</p>

                  <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    {book.publishedYear && <Fact label="First published" value={String(book.publishedYear)} />}
                    {book.pageCount && <Fact label="Pages" value={book.pageCount.toLocaleString()} />}
                    {book.isbn13 && <Fact label="ISBN" value={book.isbn13} mono />}
                  </dl>
                  {book.genres.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-2" aria-label="Genres">
                      {book.genres.map((genre) => (
                        <li key={genre} className="rounded-full bg-moss-soft px-3 py-1 text-xs font-medium text-moss">
                          {genre}
                        </li>
                      ))}
                    </ul>
                  )}

                  {visitor ? <VisitorCard entry={entry} {...visitor} /> : <OwnerCard entry={entry} onClose={onClose} />}
                  {description ? (
                    <Description text={description} />
                  ) : related.isPending && !visitor ? (
                    <div className="mt-8 h-24 animate-pulse rounded-xl bg-line/40" aria-hidden />
                  ) : null}
                </div>
              </div>

              {!visitor && <RelatedShelves entry={entry} related={related} onSearch={onSearch} />}
            </motion.article>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** The reader's own copy: shelf, stars, dates, and notes, all editable in place. */
function OwnerCard({ entry, onClose }: { entry: LibraryEntry; onClose: () => void }) {
  const move = useMoveEntry()
  const update = useUpdateEntry()
  const remove = useRemoveEntry()
  return (
    <>
      <section className="mt-8 rounded-2xl border border-line bg-paper/60 p-5 sm:p-6" aria-label="Your copy">
        <div className="flex flex-wrap gap-1.5 rounded-full border border-line bg-card p-1" role="radiogroup" aria-label="Shelf">
          {SHELVES.map((shelf) => {
            const active = entry.shelf === shelf
            return (
              <button
                key={shelf}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => move(entry, shelf)}
                className={clsx(
                  'relative flex-1 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  active ? 'text-on-moss' : 'text-ink-soft hover:text-ink',
                )}
              >
                {active && <motion.span layoutId="detail-shelf" transition={snappy} className="absolute inset-0 rounded-full bg-moss" />}
                <span className="relative">{SHELF_LABELS[shelf]}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-6">
          <StarRating value={entry.rating} onChange={(rating) => update.mutate({ id: entry.id, patch: { rating } })} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <DateField
            label="Started"
            value={entry.startedAt}
            max={entry.finishedApprox ? undefined : (entry.finishedAt ?? undefined)}
            onChange={(startedAt) => update.mutate({ id: entry.id, patch: { startedAt } })}
          />
          <DateField
            label="Finished"
            value={entry.finishedApprox ? null : entry.finishedAt}
            placeholderNote={entry.finishedApprox && entry.finishedAt ? `sometime in ${entry.finishedAt.slice(0, 4)}` : undefined}
            min={entry.startedAt ?? undefined}
            onChange={(finishedAt) => update.mutate({ id: entry.id, patch: { finishedAt } })}
          />
        </div>

        <NotesField key={entry.id} initial={entry.notes} onSave={(notes) => update.mutateAsync({ id: entry.id, patch: { notes } })} />
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-ink-faint">
          On your shelves since {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </p>
        <button
          type="button"
          onClick={() => {
            remove.mutate(entry)
            onClose()
          }}
          className="rounded-full px-3 py-1.5 text-rose transition hover:bg-rose-soft"
        >
          Take off the shelves
        </button>
      </div>
    </>
  )
}

/** What a visitor to a shared library sees, plus the invitation to shelve it themselves. */
function VisitorCard({ entry, ownerName, action }: { entry: LibraryEntry; ownerName: string; action: ReactNode }) {
  const first = ownerName.split(' ')[0]
  return (
    <section className="mt-8 rounded-2xl border border-line bg-paper/60 p-5 sm:p-6" aria-label={`${first}’s copy`}>
      <p className="font-hand text-xl text-ink-soft">
        On {first}’s <span className="text-ink">{SHELF_LABELS[entry.shelf]}</span> shelf
        {entry.shelf === 'read' && entry.finishedAt ? `, finished ${finishedLabel(entry)}` : ''}
      </p>
      {entry.rating && (
        <p className="mt-2 flex items-center gap-2" aria-label={`${first} gave it ${entry.rating} of 5 stars`}>
          {Array.from({ length: 5 }, (_, i) => (
            <svg key={i} viewBox="0 0 24 24" className={clsx('size-6', i < entry.rating! ? 'fill-marigold' : 'fill-line')} aria-hidden>
              <path d="M12 2.6 L14.7 8.6 L21.1 9.2 L16.3 13.5 L17.8 19.9 L12 16.5 L6.3 20 L7.7 13.6 L2.8 9.3 L9.3 8.5 Z" />
            </svg>
          ))}
        </p>
      )}
      <div className="mt-5">{action}</div>
    </section>
  )
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-ink-faint">{label}</dt>
      <dd className={clsx('text-ink', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  )
}

function DateField({
  label,
  value,
  onChange,
  min,
  max,
  placeholderNote,
}: {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  min?: string
  max?: string
  placeholderNote?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="font-hand text-lg text-ink-soft">{label}</span>
        {placeholderNote && <span className="font-hand text-base text-moss">{placeholderNote}</span>}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={value ?? ''}
          min={min}
          max={max}
          onChange={(event) => onChange(event.target.value || null)}
          className="w-full rounded-xl border border-line-control bg-card px-3 py-2 font-mono text-sm text-ink transition focus:border-moss"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Clear ${label.toLowerCase()} date`}
            className="shrink-0 rounded-full px-2 py-1 text-xs text-ink-faint hover:text-ink"
          >
            clear
          </button>
        )}
      </div>
    </label>
  )
}

/** Notes save themselves a moment after you stop typing, and again when you leave the field. */
function NotesField({ initial, onSave }: { initial: string | null; onSave: (notes: string | null) => Promise<unknown> }) {
  const [text, setText] = useState(initial ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saved = useRef(initial ?? '')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const flush = async (value: string) => {
    clearTimeout(timer.current)
    if (value === saved.current) return
    setStatus('saving')
    try {
      await onSave(value.trim() ? value : null)
      saved.current = value
      setStatus('saved')
    } catch {
      setStatus('idle')
    }
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <label className="mt-6 block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="font-hand text-lg text-ink-soft">Notes in the margin</span>
        <AnimatePresence mode="wait">
          {status !== 'idle' && (
            <motion.span
              key={status}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="font-hand text-base text-moss"
            >
              {status === 'saving' ? 'writing…' : 'kept ✓'}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <textarea
        value={text}
        rows={5}
        maxLength={20000}
        placeholder="What stayed with you? A line, a feeling, who you'd lend it to…"
        onChange={(event) => {
          const value = event.target.value
          setText(value)
          setStatus('idle')
          clearTimeout(timer.current)
          timer.current = setTimeout(() => void flush(value), 900)
        }}
        onBlur={() => void flush(text)}
        className="w-full resize-y rounded-xl border border-line-control bg-card px-4 py-3 font-display text-[1.05rem] leading-relaxed text-ink transition placeholder:text-ink-faint focus:border-moss"
        style={{
          backgroundImage: 'repeating-linear-gradient(transparent 0 1.72rem, var(--line) 1.72rem calc(1.72rem + 1px))',
          backgroundPositionY: '0.95rem',
        }}
      />
    </label>
  )
}

function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const long = text.length > 420
  return (
    <section className="mt-8" aria-label="About this book">
      <h3 className="font-hand text-xl text-ink-soft">From the jacket</h3>
      <div className={clsx('relative mt-2 overflow-hidden', !open && long && 'max-h-40')}>
        <p className="font-display text-[1.05rem] leading-relaxed whitespace-pre-line text-ink/90">{text}</p>
        {!open && long && <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />}
      </div>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-2 text-sm font-medium text-moss underline-offset-4 hover:underline">
          {open ? 'Show less' : 'Read more'}
        </button>
      )}
    </section>
  )
}

/** The library stamp: thunk. Lands when a book is finished. */
function FinishedStamp({ label }: { label: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      aria-label={`Finished ${label}`}
      className="pointer-events-none absolute -right-6 bottom-8 rotate-[-9deg] rounded-md border-[3px] border-[#a33b3b] bg-[#f7f0e1]/90 px-3 py-1.5 text-center text-[#a33b3b] shadow-[0_6px_16px_-8px_rgb(0_0_0/0.5)]"
      style={{ filter: 'url(#la-wobble)' }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 2.2, rotate: -20 }}
      animate={{ opacity: 0.92, scale: 1, rotate: -9 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 520, damping: 22 }}
    >
      <p className="font-mono text-[10px] font-medium tracking-[0.3em]">FINISHED</p>
      <p className="font-mono text-sm font-medium tracking-wider uppercase">{label}</p>
    </motion.div>
  )
}
