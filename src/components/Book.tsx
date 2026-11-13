import { clsx } from 'clsx'
import { motion, useReducedMotion } from 'motion/react'
import { useState, type CSSProperties } from 'react'
import type { Book as BookData } from '../../shared/types'
import { api } from '../lib/api'
import { fallbackSpine, inkOn, sampleSpineColor } from '../lib/color'
import { settle } from '../lib/motion'

/** Spines are sampled once per book per page load, then remembered by the catalogue. */
const sampled = new Set<string>()

export type BookSize = 'sm' | 'md' | 'lg'
const SIZES: Record<BookSize, { w: number; h: number }> = {
  sm: { w: 64, h: 96 },
  md: { w: 108, h: 162 },
  lg: { w: 220, h: 330 },
}

/** Spine thickness follows page count, so a doorstop looks like one. */
export function thicknessFor(pages: number | null, size: BookSize) {
  const scale = size === 'lg' ? 2 : size === 'sm' ? 0.6 : 1
  return Math.round(Math.max(9, Math.min(34, (pages ?? 300) / 22)) * scale)
}

interface CoverProps {
  book: BookData
  entryId?: string
  size?: BookSize
  className?: string
  /** Turn the book a little so its spine and pages show. */
  tilt?: number
}

/** The cover itself: the publisher's art, or a cloth binding we set in type. */
export function Cover({ book, entryId, size = 'md', className, tilt = 0 }: CoverProps) {
  const [failed, setFailed] = useState(false)
  const [spine, setSpine] = useState(book.spineColor)
  const { w, h } = SIZES[size]
  const cloth = spine ?? fallbackSpine(book.title)
  const showImage = book.coverUrl && !failed

  return (
    <div
      className={clsx('book-3d relative', className)}
      style={
        {
          '--w': `${w}px`,
          '--h': `${h}px`,
          '--t': `${thicknessFor(book.pageCount, size)}px`,
          '--spine': cloth,
          transform: tilt ? `rotateY(${tilt}deg)` : undefined,
        } as CSSProperties
      }
    >
      <div className="book-spine" />
      <div className="book-pages" />
      <div className="book-face" style={{ background: cloth }}>
        {showImage ? (
          <img
            src={book.coverUrl!}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
            onLoad={(event) => {
              if (book.spineColor || !entryId || sampled.has(book.id)) return
              sampled.add(book.id)
              const color = sampleSpineColor(event.currentTarget)
              if (!color) return
              setSpine(color)
              void api.spine(entryId, color).catch(() => sampled.delete(book.id))
            }}
          />
        ) : (
          <ClothCover book={book} color={cloth} size={size} />
        )}
      </div>
    </div>
  )
}

/** A typeset cover for books the catalogues have no picture of. */
function ClothCover({ book, color, size }: { book: BookData; color: string; size: BookSize }) {
  const ink = inkOn(color)
  return (
    <div
      className="flex h-full w-full flex-col justify-between p-[9%] text-center"
      style={{
        color: ink,
        background: `linear-gradient(160deg, rgb(255 255 255 / 0.08), transparent 60%), ${color}`,
      }}
    >
      <div className="mx-auto h-px w-1/2 opacity-50" style={{ background: ink }} />
      <p
        className={clsx(
          'font-display leading-[1.05] font-semibold text-balance',
          size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-[9px]' : 'text-sm',
        )}
      >
        {book.title}
      </p>
      <p
        className={clsx(
          'font-sans tracking-wide uppercase opacity-80',
          size === 'lg' ? 'text-xs' : 'text-[7px]',
        )}
      >
        {book.authors[0] ?? ''}
      </p>
    </div>
  )
}

interface ShelfBookProps {
  book: BookData
  /** Set for the reader's own books, so the cover's colour can be saved. */
  entryId?: string
  /** Pairs this cover with the detail view's for the shared-element flight. */
  layoutKey: string
  /** The drag handle: the book itself, so it is one control to open and to drag. */
  handleRef?: (element: Element | null) => void
  /** While the detail view holds this cover, its slot on the shelf stays empty. */
  hidden?: boolean
  dragging?: boolean
  onOpen: () => void
}

/**
 * A book standing on the shelf. Hover lifts it and turns it toward you; the
 * cover carries a layoutId so it can fly into the detail view and back.
 */
export function ShelfBook({
  book,
  entryId,
  layoutKey,
  handleRef,
  hidden,
  dragging,
  onOpen,
}: ShelfBookProps) {
  const reduce = useReducedMotion()
  const { w, h } = SIZES.md
  return (
    <div className="relative shrink-0" style={{ width: w, height: h, perspective: 900 }}>
      {/* The shadow on the plank, which spreads as the book lifts. */}
      <div
        aria-hidden
        className={clsx(
          'absolute -bottom-1 left-1/2 h-3 w-[86%] -translate-x-1/2 rounded-[50%] bg-black/30 blur-[6px] transition-all duration-300',
          dragging ? 'scale-75 opacity-20' : 'opacity-60',
        )}
      />
      {/* While the detail card holds this cover, the button stays mounted (it is
          the drag handle) but steps aside: invisible, unfocusable, unpaired. */}
      <motion.button
        ref={handleRef}
        type="button"
        layoutId={hidden ? undefined : `cover-${layoutKey}`}
        aria-hidden={hidden || undefined}
        tabIndex={hidden ? -1 : undefined}
        onClick={onOpen}
        aria-label={`Open ${book.title}${book.authors[0] ? ` by ${book.authors[0]}` : ''}`}
        className="group absolute inset-0 block cursor-pointer rounded-sm outline-offset-4"
        style={{
          transformStyle: 'preserve-3d',
          transformOrigin: '50% 100%',
          visibility: hidden ? 'hidden' : undefined,
        }}
        initial={false}
        whileHover={reduce || dragging ? undefined : { y: -12, rotateY: -18, rotateX: 4 }}
        whileTap={reduce ? undefined : { scale: 0.97 }}
        animate={dragging ? { rotateZ: -4, scale: 1.06, y: -8 } : { rotateZ: 0, scale: 1, y: 0 }}
        transition={settle}
      >
        <Cover book={book} entryId={entryId} />
      </motion.button>
    </div>
  )
}
