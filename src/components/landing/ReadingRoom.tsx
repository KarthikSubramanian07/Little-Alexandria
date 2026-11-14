// The landing page's hero: a real bookcase in a sunlit room, filled with real
// covers that drop onto the shelves one after another, a cat asleep on top, and
// the headline set into the wall above it. At night the picture light comes on.
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import type { Book } from '../../../shared/types'
import { Cover } from '../Book'
import { BookStack, Candle, Dust } from '../art/shelf-props'
import { SleepingCat } from './Cat'
import { SHOWCASE_BOOKS } from './showcase'

const ROWS: Array<{ label: string; books: Book[]; prop: ReactNode; lean?: boolean }> = [
  { label: 'Currently Reading', books: SHOWCASE_BOOKS.slice(0, 6), prop: <Candle /> },
  {
    label: 'Read',
    books: [...SHOWCASE_BOOKS.slice(7, 12), SHOWCASE_BOOKS[13]!],
    prop: <BookStack seed="landing" />,
    lean: true,
  },
]

/** One book dropping onto its shelf, in turn. */
function ShelvedBook({ book, order, lean }: { book: Book; order: number; lean?: boolean }) {
  const reduce = useReducedMotion()
  return (
    <motion.li
      className="relative shrink-0 list-none"
      style={lean ? { transformOrigin: '0% 100%' } : undefined}
      initial={reduce ? undefined : { y: -70, opacity: 0, rotate: order % 2 ? 6 : -6 }}
      animate={reduce ? undefined : { y: 0, opacity: 1, rotate: lean ? 9 : 0 }}
      transition={{ type: 'spring', stiffness: 210, damping: 17, delay: 0.55 + order * 0.07 }}
      whileHover={
        reduce ? undefined : { y: -10, transition: { type: 'spring', stiffness: 400, damping: 18 } }
      }
    >
      <div
        aria-hidden
        className="absolute inset-y-3 -right-3 left-5 rounded-sm bg-black/45 blur-[8px]"
      />
      <Cover book={book} labelled />
    </motion.li>
  )
}

export function ReadingRoom({ children, caption }: { children: ReactNode; caption?: ReactNode }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  // A little depth as you scroll away: the words lift off the wall faster than the furniture.
  const wordsY = useTransform(scrollYProgress, [0, 1], [0, -110])
  const wordsFade = useTransform(scrollYProgress, [0, 0.6], [1, 0.2])
  let order = 0

  return (
    <div ref={ref} className="reading-room relative isolate overflow-hidden">
      <div aria-hidden className="room-beams" />
      <motion.div
        style={reduce ? undefined : { y: wordsY, opacity: wordsFade }}
        className="relative z-10 mx-auto max-w-4xl px-5 pt-28 text-center sm:px-8 md:pt-36"
      >
        {children}
      </motion.div>

      <div className="relative mx-auto mt-24 max-w-5xl px-3 pb-24 sm:px-8 md:pb-32">
        {caption && (
          <div className="absolute -top-[60px] left-10 z-20 hidden rotate-[-3deg] md:block">
            {caption}
          </div>
        )}
        <SleepingCat className="absolute -top-[74px] right-[9%] z-20 h-[104px] w-[136px] text-ink-faint sm:right-[14%]" />
        <figure className="bookcase" aria-label="An example bookcase, with real covers">
          <div aria-hidden className="bookcase-crown">
            <div className="picture-light" />
          </div>
          {ROWS.map((row, rowIndex) => (
            <div key={row.label}>
              <div className="compartment">
                {rowIndex === 0 && <div aria-hidden className="lamp-glow" />}
                <Dust seed={`landing-${rowIndex}`} count={6} />
                <ol className="relative flex min-h-[214px] items-end gap-5 overflow-hidden px-4 pt-10 max-sm:[zoom:0.62] sm:px-7">
                  {row.books.map((book) => (
                    <ShelvedBook
                      key={book.id}
                      book={book}
                      order={order++}
                      lean={row.lean && book === row.books.at(-1)}
                    />
                  ))}
                  <li
                    aria-hidden
                    className="pointer-events-none ml-3 h-[138px] w-[100px] shrink-0 list-none self-end"
                  >
                    {row.prop}
                  </li>
                </ol>
              </div>
              <div aria-hidden className="plank-top" />
              <div aria-hidden className="plank-front flex items-center px-3 py-2 sm:px-5">
                <span className="label-holder">
                  <span className="font-display text-sm sm:text-base">{row.label}</span>
                </span>
              </div>
            </div>
          ))}
          <div aria-hidden className="bookcase-plinth" />
        </figure>
      </div>
      {/* The floor meets the wall just behind the bookcase's feet. */}
      <div aria-hidden className="room-floor h-[124px] md:h-[156px]" />
    </div>
  )
}
