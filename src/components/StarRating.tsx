import { clsx } from 'clsx'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRef, useState, type KeyboardEvent } from 'react'

// A five-point star drawn by hand: the points aren't quite even, on purpose.
const STAR = 'M12 2.6 L14.7 8.6 L21.1 9.2 L16.3 13.5 L17.8 19.9 L12 16.5 L6.3 20 L7.7 13.6 L2.8 9.3 L9.3 8.5 Z'
const WORDS = ['', 'Not for me', 'It was fine', 'Liked it', 'Really liked it', 'Loved it']

interface StarRatingProps {
  value: number | null
  onChange: (value: number | null) => void
  label?: string
}

/**
 * A radio group of five stars. Hover previews, click commits (click the same
 * star again to clear), arrow keys work, and each committed star gives a small pop.
 */
export function StarRating({ value, onChange, label = 'Your rating' }: StarRatingProps) {
  const reduce = useReducedMotion()
  const [hover, setHover] = useState<number | null>(null)
  const [burst, setBurst] = useState(0)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const shown = hover ?? value ?? 0

  const commit = (next: number | null) => {
    onChange(next)
    if (next) setBurst((b) => b + 1)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const current = value ?? 0
    let next: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(5, current + 1)
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(1, current - 1)
    if (event.key === 'Home') next = 1
    if (event.key === 'End') next = 5
    if (next !== null) {
      event.preventDefault()
      commit(next)
      refs.current[next - 1]?.focus()
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <div role="radiogroup" aria-label={label} className="flex" onMouseLeave={() => setHover(null)} onKeyDown={onKeyDown}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= shown
          const checked = value === star
          return (
            <button
              key={star}
              ref={(element) => {
                refs.current[star - 1] = element
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${star} ${star === 1 ? 'star' : 'stars'}: ${WORDS[star]}`}
              tabIndex={checked || (!value && star === 1) ? 0 : -1}
              onMouseEnter={() => setHover(star)}
              onFocus={() => setHover(null)}
              onClick={() => commit(value === star ? null : star)}
              className="relative -m-0.5 p-1.5"
            >
              <motion.svg
                viewBox="0 0 24 24"
                className="size-8"
                key={checked ? `on-${burst}` : 'off'}
                initial={checked && !reduce ? { scale: 0.6, rotate: -18 } : false}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 12, delay: checked ? 0 : 0 }}
                whileHover={reduce ? undefined : { scale: 1.15, rotate: 6 }}
                whileTap={reduce ? undefined : { scale: 0.85 }}
              >
                <path
                  d={STAR}
                  filter="url(#la-wobble)"
                  className={clsx(
                    'transition-[fill,stroke] duration-200',
                    filled ? 'fill-marigold stroke-[color-mix(in_oklab,var(--marigold)_60%,var(--ink))]' : 'fill-transparent stroke-line-strong',
                  )}
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </motion.svg>
              <AnimatePresence>
                {checked && !reduce && burst > 0 && (
                  <Sparks key={burst} />
                )}
              </AnimatePresence>
            </button>
          )
        })}
      </div>
      <span className="min-w-28 font-hand text-xl text-ink-soft" aria-live="polite">
        {WORDS[shown] || (value ? '' : 'Unrated')}
      </span>
    </div>
  )
}

/** Six little flecks of marigold that fly off a star when you commit a rating. */
function Sparks() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2
        return (
          <motion.span
            key={i}
            className="absolute top-1/2 left-1/2 size-1.5 rounded-full bg-marigold"
            initial={{ x: '-50%', y: '-50%', opacity: 1, scale: 1 }}
            animate={{ x: `calc(-50% + ${Math.cos(angle) * 22}px)`, y: `calc(-50% + ${Math.sin(angle) * 22}px)`, opacity: 0, scale: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        )
      })}
    </span>
  )
}
