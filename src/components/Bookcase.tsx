import { CollisionPriority } from '@dnd-kit/abstract'
import { DragDropProvider, useDroppable } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { useNavigate } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { createContext, use, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { positionAt } from '../../shared/positions'
import { SHELF_LABELS, SHELVES, type LibraryEntry, type Shelf } from '../../shared/types'
import { settle } from '../lib/motion'
import { shelfOf, useMoveEntry } from '../lib/queries'
import { EmptyShelfArt } from './art/scenes'
import { ShelfBook } from './Book'
import { BookMenu } from './BookMenu'

const SHELF_NOTES: Record<Shelf, { empty: string; hint: string }> = {
  want_to_read: {
    empty: 'Nothing planted yet. Every library starts with one seed.',
    hint: 'the someday pile',
  },
  reading: {
    empty: 'No book open right now. Pick one up and we’ll keep your place.',
    hint: 'on the nightstand',
  },
  read: {
    empty: 'Finished books bloom here. Your first one is the hardest to put down.',
    hint: 'well loved',
  },
}

interface BookcaseState {
  dragging: boolean
  openId: string | null
  /** Ids that were already on the shelves, so only genuinely new books drop in. */
  known: Set<string>
}
const BookcaseContext = createContext<BookcaseState>({ dragging: false, openId: null, known: new Set() })

export function Bookcase({
  entries,
  openId,
  onFindBook,
}: {
  entries: LibraryEntry[]
  openId: string | null
  onFindBook: (shelf: Shelf) => void
}) {
  const move = useMoveEntry()
  const [dragging, setDragging] = useState(false)
  const byShelf = useMemo(
    () => Object.fromEntries(SHELVES.map((shelf) => [shelf, shelfOf(entries, shelf)])) as Record<Shelf, LibraryEntry[]>,
    [entries],
  )

  // Remember which books were here at the last render; anything else is new.
  const knownRef = useRef<Set<string>>(new Set(entries.map((entry) => entry.id)))
  const known = knownRef.current
  useEffect(() => {
    knownRef.current = new Set(entries.map((entry) => entry.id))
  }, [entries])

  return (
    <BookcaseContext value={{ dragging, openId, known }}>
      <DragDropProvider
        onDragStart={() => setDragging(true)}
        onDragEnd={(event) => {
          setDragging(false)
          if (event.canceled) return
          const { source } = event.operation
          if (!isSortable(source)) return
          const group = source.group as Shelf | undefined
          const entry = entries.find((candidate) => candidate.id === source.id)
          if (!group || !entry) return
          if (group === entry.shelf && source.index === source.initialIndex) return
          const others = byShelf[group].filter((other) => other.id !== entry.id)
          move(entry, group, positionAt(others, source.index))
        }}
      >
        <LayoutGroup>
          <div className="flex flex-col gap-10 sm:gap-14">
            {SHELVES.map((shelf, index) => (
              <ShelfRow key={shelf} shelf={shelf} entries={byShelf[shelf]} index={index} onFindBook={onFindBook} />
            ))}
          </div>
        </LayoutGroup>
      </DragDropProvider>
    </BookcaseContext>
  )
}

function ShelfRow({
  shelf,
  entries,
  index,
  onFindBook,
}: {
  shelf: Shelf
  entries: LibraryEntry[]
  index: number
  onFindBook: (shelf: Shelf) => void
}) {
  const { ref, isDropTarget } = useDroppable({
    id: shelf,
    type: 'shelf',
    accept: 'book',
    collisionPriority: CollisionPriority.Low,
  })
  const notes = SHELF_NOTES[shelf]
  const headingId = `shelf-${shelf}`

  return (
    <motion.section
      aria-labelledby={headingId}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...settle, delay: index * 0.08 }}
    >
      <header className="mb-3 flex items-baseline justify-between gap-4 px-1">
        <div className="flex items-baseline gap-3">
          <h2 id={headingId} className="font-display text-2xl font-medium tracking-tight sm:text-[1.7rem]">
            {SHELF_LABELS[shelf]}
          </h2>
          <span className="font-hand text-lg text-ink-faint">{notes.hint}</span>
        </div>
        <span className="font-mono text-xs text-ink-faint tabular-nums">
          {entries.length} {entries.length === 1 ? 'book' : 'books'}
        </span>
      </header>

      <div
        ref={ref}
        className={clsx(
          'shelf-back relative rounded-t-xl transition-colors duration-300',
          isDropTarget && 'bg-moss-soft/50',
        )}
      >
        {entries.length === 0 ? (
          <EmptyShelf shelf={shelf} note={notes.empty} onFindBook={() => onFindBook(shelf)} />
        ) : (
          <ol
            className="scrollbar-none flex min-h-[200px] items-end gap-5 overflow-x-auto px-4 pt-10 pb-0 sm:gap-6 sm:px-6"
            style={{ maskImage: 'linear-gradient(90deg, transparent, black 16px, black calc(100% - 24px), transparent)' }}
          >
            <AnimatePresence initial={true} mode="popLayout">
              {entries.map((entry, i) => (
                <SortableBook key={entry.id} entry={entry} index={i} shelf={shelf} />
              ))}
            </AnimatePresence>
            <li aria-hidden className="w-2 shrink-0" />
          </ol>
        )}
        <div className="plank" />
      </div>
    </motion.section>
  )
}

function SortableBook({ entry, index, shelf }: { entry: LibraryEntry; index: number; shelf: Shelf }) {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const { dragging: anyDragging, openId, known } = use(BookcaseContext)
  const { ref, isDragging } = useSortable({
    id: entry.id,
    index,
    group: shelf,
    type: 'book',
    accept: 'book',
  })
  const isNew = !known.has(entry.id)

  return (
    <motion.li
      ref={ref}
      layout={anyDragging || reduce ? false : 'position'}
      className="group/book relative shrink-0 list-none pb-0 [touch-action:manipulation]"
      initial={isNew && !reduce ? { opacity: 0, y: -60, rotate: -8, scale: 0.9 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.92, transition: { duration: 0.2 } }}
      transition={
        isNew
          ? { type: 'spring', stiffness: 320, damping: 18, mass: 1.1 }
          : { ...settle, delay: Math.min(index, 12) * 0.035 }
      }
      data-dragging={isDragging || undefined}
    >
      <ShelfBook
        book={entry.book}
        entryId={entry.id}
        hidden={openId === entry.id}
        dragging={isDragging}
        onOpen={() => void navigate({ to: '/library/$entryId', params: { entryId: entry.id } })}
      />
      <BookMenu entry={entry} />
    </motion.li>
  )
}

function EmptyShelf({ shelf, note, onFindBook }: { shelf: Shelf; note: string; onFindBook: () => void }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 px-6 pt-6 pb-5 text-center sm:flex-row sm:gap-8 sm:text-left">
      <div className="size-24 shrink-0 sm:size-28">
        <EmptyShelfArt shelf={shelf} />
      </div>
      <div className="max-w-sm">
        <p className="font-hand text-xl leading-snug text-ink-soft">{note}</p>
        <button
          type="button"
          onClick={onFindBook}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-1.5 text-sm font-medium text-ink transition hover:border-moss hover:bg-moss hover:text-on-moss active:scale-[0.97]"
        >
          Find a book
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  )
}

export function BookcaseSkeleton(): ReactNode {
  return (
    <div className="flex flex-col gap-14" aria-busy aria-label="Loading your shelves">
      {SHELVES.map((shelf) => (
        <div key={shelf}>
          <div className="mb-3 h-7 w-48 animate-pulse rounded bg-line" />
          <div className="shelf-back rounded-t-xl">
            <div className="flex min-h-[200px] items-end gap-6 px-6 pt-10">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[162px] w-[108px] animate-pulse rounded-sm bg-line" />
              ))}
            </div>
            <div className="plank" />
          </div>
        </div>
      ))}
    </div>
  )
}
