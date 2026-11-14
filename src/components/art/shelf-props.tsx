// The odds and ends that make a bookcase somebody's: a sprout for the someday
// pile, a candle for whoever is reading late, and a stack of finished books
// lying flat. Hand-drawn like everything else, and quietly alive.
import { useReducedMotion } from 'motion/react'
import type { Shelf } from '../../../shared/types'
import { CRAYON, seeded } from './palette'
import { PotWithSprout } from './scenes'

const line = {
  fill: 'none',
  stroke: CRAYON.ink,
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** A candle in a little brass holder, its flame never quite still. */
export function Candle() {
  return (
    <svg viewBox="0 0 70 130" className="h-full w-full overflow-visible" aria-hidden>
      {/* the glow, which breathes with the flame */}
      <circle cx="35" cy="34" r="30" fill={CRAYON.butter} opacity="0.28" className="flame" />
      <g filter="url(#la-wobble)">
        <path
          className="flame"
          d="M35 18 C 28 30, 29 42, 35 45 C 41 42, 42 30, 35 18 Z"
          fill={CRAYON.marigold}
          stroke={CRAYON.coral}
          strokeWidth="1.6"
        />
        <path d="M35 46 L35 52" {...line} strokeWidth={1.8} />
        <path d="M24 52 L46 52 L46 108 L24 108 Z" fill={CRAYON.cream} filter="url(#la-crayon)" />
        <path d="M24 52 L46 52 L46 108 L24 108 Z" {...line} />
        <path d="M24 60 q 4 6 0 12" {...line} stroke={CRAYON.butter} strokeWidth={3} />
        <path
          d="M12 108 L58 108 L54 120 L16 120 Z"
          fill={CRAYON.marigold}
          filter="url(#la-crayon)"
        />
        <path d="M12 108 L58 108 L54 120 L16 120 Z" {...line} />
        <path d="M58 112 q 10 0 8 8 q -2 4 -10 2" {...line} />
      </g>
    </svg>
  )
}

/** Three finished books lying flat, the way a real shelf ends up. */
export function BookStack({ seed = 'stack' }: { seed?: string }) {
  const rand = seeded(seed)
  const colours = [
    CRAYON.rose,
    CRAYON.sky,
    CRAYON.leaf,
    CRAYON.lilac,
    CRAYON.marigold,
    CRAYON.coral,
  ]
  const books = [0, 1, 2].map((i) => ({
    width: 92 - i * 10 - Math.round(rand() * 8),
    shift: Math.round((rand() - 0.5) * 12),
    colour: colours[Math.floor(rand() * colours.length)]!,
    y: 108 - i * 22,
  }))
  return (
    <svg viewBox="0 0 120 130" className="h-full w-full overflow-visible" aria-hidden>
      <g filter="url(#la-wobble)">
        {books.map((book, i) => {
          const x = 60 - book.width / 2 + book.shift
          return (
            <g key={i}>
              <rect
                x={x}
                y={book.y}
                width={book.width}
                height="20"
                rx="3"
                fill={book.colour}
                filter="url(#la-crayon)"
              />
              {/* the page edges */}
              <rect
                x={x + book.width - 10}
                y={book.y + 3}
                width="8"
                height="14"
                fill={CRAYON.cream}
              />
              <rect x={x} y={book.y} width={book.width} height="20" rx="3" {...line} />
              <path
                d={`M${x + 10} ${book.y + 10} h ${book.width * 0.45}`}
                {...line}
                strokeWidth={1.4}
              />
            </g>
          )
        })}
        {/* a little flower in a jar on top */}
        <path d="M54 66 L66 66 L64 86 L56 86 Z" fill="#cfe3e8" opacity="0.8" />
        <path d="M54 66 L66 66 L64 86 L56 86 Z" {...line} strokeWidth={1.6} />
        <g className="sway">
          <path d="M60 66 C 59 56, 61 50, 60 42" {...line} stroke={CRAYON.moss} strokeWidth={2} />
          <circle cx="60" cy="40" r="6" fill={CRAYON.rose} stroke={CRAYON.ink} strokeWidth="1.6" />
          <circle cx="60" cy="40" r="2" fill={CRAYON.butter} />
        </g>
      </g>
    </svg>
  )
}

/** The prop at the end of each shelf. */
export function ShelfProp({ shelf }: { shelf: Shelf }) {
  if (shelf === 'reading') return <Candle />
  if (shelf === 'read') return <BookStack seed="read-shelf" />
  return <PotWithSprout />
}

/** Specks of dust drifting through the sunbeam. Daylight only; still when motion is reduced. */
export function Dust({ count = 7, seed = 'dust' }: { count?: number; seed?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return null
  const rand = seeded(seed)
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="dust"
          style={
            {
              left: `${Math.round(rand() * 90)}%`,
              top: `${Math.round(rand() * 50)}%`,
              '--dur': `${12 + Math.round(rand() * 10)}s`,
              '--delay': `${-Math.round(rand() * 20)}s`,
              '--dx': `${Math.round(30 + rand() * 80)}px`,
              '--dy': `${Math.round(40 + rand() * 90)}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
