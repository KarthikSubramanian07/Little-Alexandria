import { CollisionPriority } from '@dnd-kit/abstract'
import { PointerActivationConstraints } from '@dnd-kit/dom'
import { DragDropProvider, KeyboardSensor, PointerSensor, useDroppable } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { clsx } from 'clsx'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'
import { positionAt } from '../../shared/positions'
import { SHELF_LABELS, SHELVES, type LibraryEntry, type Shelf } from '../../shared/types'
import { settle } from '../lib/motion'
import { shelfOf, useMoveEntry } from '../lib/queries'
import { EmptyShelfArt } from './art/scenes'
import { Dust, ShelfProp } from './art/shelf-props'
import { ShelfBook } from './Book'
import { BookMenu } from './BookMenu'

const SHELF_NOTES: Record<Shelf, { empty: string; hint: string; emptyPublic: string }> = {
  want_to_read: {
    empty: 'Nothing planted yet. Every library starts with one seed.',
    emptyPublic: 'No wishlist yet.',
    hint: 'the someday pile',
  },
  reading: {
    empty: 'No book open right now. Pick one up and we’ll keep your place.',
    emptyPublic: 'Between books right now.',
    hint: 'on the nightstand',
  },
  read: {
    empty: 'Finished books bloom here. Your first one is the hardest to put down.',
    emptyPublic: 'Nothing finished yet.',
    hint: 'well loved',
  },
}

/**
 * The book is both the button that opens it and the handle that drags it, so
 * Enter opens it and Space picks it up (arrows move it, Space or Enter drops it).
 */
const SENSORS = [
  // A click opens the book; a drag needs a deliberate nudge (mouse) or a
  // press-and-hold (touch), so scrolling a shelf on a phone never grabs a book.
  PointerSensor.configure({
    activationConstraints: (event) =>
      event.pointerType === 'touch'
        ? [new PointerActivationConstraints.Delay({ value: 250, tolerance: 6 })]
        : [new PointerActivationConstraints.Distance({ value: 6 })],
  }),
  KeyboardSensor.configure({
    keyboardCodes: {
      start: ['Space'],
      cancel: ['Escape'],
      end: ['Space', 'Enter', 'Tab'],
      up: ['ArrowUp'],
      down: ['ArrowDown'],
      left: ['ArrowLeft'],
      right: ['ArrowRight'],
    },
  }),
]

/** A single row shows this many books before the "see the whole shelf" bookend. */
const ROW_LIMIT = 40
const BOOK_WIDTH = 108
const GAP = 24

interface BookcaseState {
  dragging: boolean
  /** Dragging is off while filtering (neighbours would be wrong) and on shared pages. */
  sortable: boolean
  readOnly: boolean
  openId: string | null
  onOpen: (entry: LibraryEntry) => void
  /** Books created after this moment are new arrivals and drop onto the shelf. */
  mountedAt: number
}
const BookcaseContext = createContext<BookcaseState>({
  dragging: false,
  sortable: false,
  readOnly: true,
  openId: null,
  onOpen: () => undefined,
  mountedAt: 0,
})

interface BookcaseProps {
  entries: LibraryEntry[]
  openId: string | null
  onOpen: (entry: LibraryEntry) => void
  onFindBook?: (shelf: Shelf) => void
  /** Shared pages: no dragging, no menus. */
  readOnly?: boolean
  /** True while the reader is filtering, which pauses drag and drop. */
  filtered?: boolean
}

export function Bookcase({
  entries,
  openId,
  onOpen,
  onFindBook,
  readOnly = false,
  filtered = false,
}: BookcaseProps) {
  const move = useMoveEntry()
  const [dragging, setDragging] = useState(false)
  const [mountedAt] = useState(() => Date.now())
  const byShelf = useMemo(
    () =>
      Object.fromEntries(SHELVES.map((shelf) => [shelf, shelfOf(entries, shelf)])) as Record<
        Shelf,
        LibraryEntry[]
      >,
    [entries],
  )
  const sortable = !readOnly && !filtered

  return (
    <BookcaseContext value={{ dragging, sortable, readOnly, openId, onOpen, mountedAt }}>
      <DragDropProvider
        sensors={SENSORS}
        onDragStart={() => setDragging(true)}
        onDragEnd={(event) => {
          setDragging(false)
          if (event.canceled || !sortable) return
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
          {/* One piece of furniture: a crown, three shelves, and a plinth. */}
          <div className="bookcase">
            <div aria-hidden className="bookcase-crown">
              <div className="picture-light" />
            </div>
            {SHELVES.map((shelf, index) => (
              <ShelfRow
                key={shelf}
                shelf={shelf}
                entries={byShelf[shelf]}
                index={index}
                onFindBook={onFindBook}
              />
            ))}
            <div aria-hidden className="bookcase-plinth" />
          </div>
        </LayoutGroup>
      </DragDropProvider>
    </BookcaseContext>
  )
}

/** How many books fit across the shelf, measured live. */
function usePerRow() {
  const [node, ref] = useState<HTMLElement | null>(null)
  const [perRow, setPerRow] = useState(6)
  useEffect(() => {
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      const width = (entry?.contentRect.width ?? 0) - 32
      setPerRow(Math.max(2, Math.floor((width + GAP) / (BOOK_WIDTH + GAP))))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return { ref, perRow }
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
  onFindBook?: (shelf: Shelf) => void
}) {
  const { readOnly } = use(BookcaseContext)
  const [expanded, setExpanded] = useState(false)
  const { ref: measure, perRow } = usePerRow()
  const { ref: drop, isDropTarget } = useDroppable({
    id: shelf,
    type: 'shelf',
    accept: 'book',
    collisionPriority: CollisionPriority.Low,
  })
  const notes = SHELF_NOTES[shelf]
  const headingId = `shelf-${shelf}`
  const overflow = entries.length > ROW_LIMIT || entries.length > perRow
  const rows = useMemo(() => {
    if (!expanded) return [entries.slice(0, ROW_LIMIT)]
    const chunks: LibraryEntry[][] = []
    for (let i = 0; i < entries.length; i += perRow) chunks.push(entries.slice(i, i + perRow))
    return chunks
  }, [entries, expanded, perRow])

  return (
    <motion.section
      aria-labelledby={headingId}
      className="flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ ...settle, delay: index * 0.08 }}
    >
      {/* First for screen readers, but drawn last: the plank's front edge, with the
          shelf's name in a brass label holder like a library's. */}
      <header className="plank-front order-last flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="label-holder">
            <h2
              id={headingId}
              className="font-display text-[1.05rem] leading-tight font-medium tracking-tight whitespace-nowrap sm:text-lg"
            >
              {SHELF_LABELS[shelf]}
            </h2>
          </span>
          <span className="hidden truncate font-hand text-lg sm:inline">{notes.hint}</span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {overflow && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              className="rounded-full px-2.5 py-0.5 text-sm font-medium underline decoration-current/40 underline-offset-4 transition hover:bg-white/10 hover:decoration-current pointer-coarse:py-2"
            >
              {expanded ? 'Fold the shelf' : 'See the whole shelf'}
            </button>
          )}
          <span className="font-mono text-xs tabular-nums">
            {entries.length.toLocaleString()} {entries.length === 1 ? 'book' : 'books'}
          </span>
        </div>
      </header>

      <div
        ref={(node) => {
          drop(node)
          measure(node)
        }}
      >
        {entries.length === 0 ? (
          <>
            <div className="compartment" data-drop-target={isDropTarget || undefined}>
              {index === 0 && <div aria-hidden className="lamp-glow" />}
              <Dust seed={`${shelf}-empty`} count={5} />
              <EmptyShelf
                shelf={shelf}
                note={readOnly ? notes.emptyPublic : notes.empty}
                onFindBook={onFindBook ? () => onFindBook(shelf) : undefined}
              />
            </div>
            <div className="plank-top" />
          </>
        ) : (
          rows.map((row, rowIndex) => {
            const offset = expanded ? rowIndex * perRow : 0
            const hidden = !expanded ? entries.length - row.length : 0
            const last = rowIndex === rows.length - 1
            return (
              <div
                key={rowIndex}
                className="[contain-intrinsic-size:auto_236px] [content-visibility:auto]"
              >
                <div className="compartment" data-drop-target={isDropTarget || undefined}>
                  {index === 0 && rowIndex === 0 && <div aria-hidden className="lamp-glow" />}
                  <Dust seed={`${shelf}-${rowIndex}`} count={5} />
                  <ol
                    className={clsx(
                      'relative flex min-h-[214px] items-end gap-6 px-4 pt-10 sm:px-7 pointer-coarse:pt-7',
                      !expanded && 'scrollbar-none overflow-x-auto',
                    )}
                    style={
                      expanded
                        ? undefined
                        : {
                            maskImage:
                              'linear-gradient(90deg, transparent, black 16px, black calc(100% - 24px), transparent)',
                          }
                    }
                  >
                    <AnimatePresence initial={true} mode="popLayout">
                      {row.map((entry, i) => (
                        <SortableBook
                          key={entry.id}
                          entry={entry}
                          index={offset + i}
                          shelf={shelf}
                        />
                      ))}
                    </AnimatePresence>
                    {hidden > 0 && (
                      <li className="shrink-0 list-none self-end pb-2">
                        <button
                          type="button"
                          onClick={() => setExpanded(true)}
                          className="flex h-[150px] w-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-[#f6ead2]/50 text-center text-[#f6ead2] transition hover:border-[#f6ead2] hover:bg-white/5"
                        >
                          <span className="font-display text-2xl">+{hidden.toLocaleString()}</span>
                          <span className="font-hand text-base leading-tight">
                            more on this shelf
                          </span>
                        </button>
                      </li>
                    )}
                    {last && (
                      <li
                        aria-hidden
                        className="pointer-events-none h-[138px] w-[100px] shrink-0 list-none self-end"
                      >
                        <ShelfProp shelf={shelf} />
                      </li>
                    )}
                    {!expanded && <li aria-hidden className="w-2 shrink-0" />}
                  </ol>
                </div>
                <div className="plank-top" />
                {!last && <div aria-hidden className="plank-front" />}
              </div>
            )
          })
        )}
      </div>
    </motion.section>
  )
}

function SortableBook({
  entry,
  index,
  shelf,
}: {
  entry: LibraryEntry
  index: number
  shelf: Shelf
}) {
  const reduce = useReducedMotion()
  const {
    dragging: anyDragging,
    sortable,
    readOnly,
    openId,
    onOpen,
    mountedAt,
  } = use(BookcaseContext)
  const { ref, handleRef, isDragging } = useSortable({
    id: entry.id,
    index,
    group: shelf,
    type: 'book',
    accept: 'book',
    disabled: !sortable,
  })
  const isNew = entry.createdAt > mountedAt

  return (
    <motion.li
      // With dragging off (shared pages, filtering) nothing is attached, so no
      // book is announced as a disabled draggable.
      ref={sortable ? ref : undefined}
      layout={anyDragging || reduce ? false : 'position'}
      className="group/book relative shrink-0 list-none [touch-action:manipulation]"
      initial={
        isNew && !reduce ? { opacity: 0, y: -60, rotate: -8, scale: 0.9 } : { opacity: 0, y: 10 }
      }
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      exit={
        reduce ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.92, transition: { duration: 0.2 } }
      }
      transition={
        isNew
          ? { type: 'spring', stiffness: 320, damping: 18, mass: 1.1 }
          : { ...settle, delay: Math.min(index % 24, 12) * 0.035 }
      }
      data-dragging={isDragging || undefined}
    >
      <ShelfBook
        book={entry.book}
        entryId={readOnly ? undefined : entry.id}
        layoutKey={entry.id}
        handleRef={sortable ? handleRef : undefined}
        hidden={openId === entry.id}
        dragging={isDragging}
        onOpen={() => onOpen(entry)}
      />
      {!readOnly && <BookMenu entry={entry} />}
    </motion.li>
  )
}

function EmptyShelf({
  shelf,
  note,
  onFindBook,
}: {
  shelf: Shelf
  note: string
  onFindBook?: () => void
}) {
  return (
    <div className="relative flex min-h-[214px] items-center justify-center px-4 pt-9 pb-6">
      {/* A note pinned to the back of the shelf, so it reads on the dark paint. */}
      <div className="pinned-note flex max-w-md -rotate-1 flex-col items-center gap-3 rounded-md px-5 py-4 text-center sm:flex-row sm:gap-6 sm:text-left">
        <div className="size-20 shrink-0 sm:size-24">
          <EmptyShelfArt shelf={shelf} />
        </div>
        <div>
          <p className="font-hand text-xl leading-snug">{note}</p>
          {onFindBook && (
            <button
              type="button"
              onClick={onFindBook}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#3b2c20]/40 px-4 py-1.5 text-sm font-medium transition hover:border-[#3e5a3a] hover:bg-[#3e5a3a] hover:text-[#f6f0e2] active:scale-[0.97] pointer-coarse:py-2.5"
            >
              Find a book
              <span aria-hidden>→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function BookcaseSkeleton(): ReactNode {
  return (
    <div className="bookcase" aria-busy aria-label="Loading your shelves">
      <div aria-hidden className="bookcase-crown" />
      {SHELVES.map((shelf) => (
        <div key={shelf}>
          <div className="compartment">
            <div className="flex min-h-[214px] items-end gap-6 px-6 pt-10">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[162px] w-[108px] animate-pulse rounded-sm bg-white/10" />
              ))}
            </div>
          </div>
          <div className="plank-top" />
          <div className="plank-front h-11" />
        </div>
      ))}
      <div aria-hidden className="bookcase-plinth" />
    </div>
  )
}
