// How it works, as three cards that stack up as you scroll, each with a small
// scene acting out its ritual: a book flying onto a shelf, a catalogue card being
// filled in and stamped, and a garden coming up. Scenes only run while in view,
// and hold their finished state when motion is reduced.
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type TargetAndTransition,
} from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { HOME } from '../../../shared/site'
import type { Book } from '../../../shared/types'
import { Flower } from '../art/Flower'
import { CRAYON } from '../art/palette'
import { GoalSun } from '../art/scenes'
import { letteringOn, SHOWCASE_BOOKS, thumbnailOf } from './showcase'

const byTitle = (title: string) => SHOWCASE_BOOKS.find((book) => book.title === title)!

/** A flat cover for the little scenes, with a cloth fallback when offline. */
function MiniCover({
  book,
  className,
  style,
}: {
  book: Book
  className?: string
  style?: CSSProperties
}) {
  const [failed, setFailed] = useState(false)
  return (
    <div
      className={`overflow-hidden rounded-[2px] shadow-[3px_5px_10px_-5px_rgb(0_0_0/0.6)] ${className ?? ''}`}
      style={{ background: book.spineColor ?? '#6b4a32', ...style }}
    >
      {book.coverUrl && !failed ? (
        <img
          src={thumbnailOf(book)!}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="grid h-full place-items-center p-1 text-center font-display text-[9px] leading-tight"
          style={{ color: letteringOn(book.spineColor ?? '#6b4a32') }}
        >
          {book.title}
        </div>
      )}
    </div>
  )
}

/** Shared timing for a looping scene: keyframes laid on one clock. */
function useLoop(duration: number) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.35 })
  const reduce = useReducedMotion()
  const playing = inView && !reduce
  const loop = (values: TargetAndTransition, times: number[], final: TargetAndTransition) =>
    playing
      ? {
          initial: false as const,
          animate: values,
          transition: { duration, times, repeat: Infinity, ease: 'easeInOut' as const },
        }
      : { initial: false as const, animate: final }
  return { ref, loop, reduce, inView }
}

function ShelveScene() {
  const { ref, loop } = useLoop(7)
  const hobbit = byTitle('The Hobbit')
  const standing = [byTitle('Circe'), byTitle('Piranesi'), byTitle('Beloved')]
  // typing, the result, the press, then a long hold before it all resets
  const t = [0, 0.16, 0.24, 0.36, 0.44, 0.58, 0.9, 1]
  return (
    <div ref={ref} aria-hidden className="relative mx-auto h-[280px] w-[300px] max-sm:[zoom:0.92]">
      {/* the search field, typing itself */}
      <div className="absolute inset-x-4 top-2 flex h-10 items-center gap-2 rounded-full border border-line-strong bg-card px-4 shadow-sm">
        <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-ink-faint">
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M13 13l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <motion.span
          className="font-display text-base whitespace-nowrap text-ink"
          {...loop(
            {
              clipPath: [
                'inset(0 100% 0 0)',
                'inset(0 0% 0 0)',
                'inset(0 0% 0 0)',
                'inset(0 0% 0 0)',
                'inset(0 0% 0 0)',
                'inset(0 0% 0 0)',
                'inset(0 0% 0 0)',
                'inset(0 100% 0 0)',
              ],
            },
            t,
            { clipPath: 'inset(0 0% 0 0)' },
          )}
        >
          the hobbit
        </motion.span>
      </div>
      {/* the result */}
      <motion.div
        className="absolute inset-x-4 top-[58px] h-[92px] rounded-2xl border border-line bg-card shadow-[0_12px_24px_-16px_rgb(var(--shadow-rgb)/0.6)]"
        {...loop({ opacity: [0, 0, 1, 1, 1, 1, 1, 0], y: [8, 8, 0, 0, 0, 0, 0, 0] }, t, {
          opacity: 1,
          y: 0,
        })}
      >
        <div className="absolute top-2 left-[68px]">
          <p className="font-display text-lg leading-tight text-ink">The Hobbit</p>
          <p className="text-xs text-ink-faint">J. R. R. Tolkien · 1937</p>
        </div>
        <motion.span
          className="absolute right-3 bottom-3 rounded-full bg-moss px-3 py-1 text-xs font-medium text-on-moss"
          {...loop({ scale: [1, 1, 1, 0.86, 1, 1, 1, 1] }, t, { scale: 1 })}
        >
          + Want to read
        </motion.span>
      </motion.div>
      {/* the shelf */}
      <div className="wood-vars absolute inset-x-4 top-[156px] h-[100px] overflow-hidden rounded-t-md">
        <div className="compartment" style={{ position: 'absolute', inset: 0 }} />
        {standing.map((book, i) => (
          <MiniCover
            key={book.id}
            book={book}
            className="absolute bottom-0 h-[75px] w-[50px]"
            style={{ left: 18 + i * 58 }}
          />
        ))}
      </div>
      <div className="wood-vars absolute inset-x-2 top-[256px]">
        <div className="plank-top !m-0" />
        <div className="plank-front !m-0 h-3 !min-h-0" />
      </div>
      {/* the book, flying from the result onto the shelf */}
      <motion.div
        className="absolute top-[66px] left-[28px] z-10"
        {...loop(
          {
            opacity: [0, 0, 1, 1, 1, 1, 1, 1, 0],
            x: [0, 0, 0, 0, 0, 80, 168, 168, 168],
            y: [0, 0, 0, 0, 0, -26, 115, 115, 115],
            rotate: [0, 0, 0, 0, 0, -10, 0, 0, 0],
          },
          [0, 0.16, 0.24, 0.36, 0.44, 0.5, 0.58, 0.9, 1],
          { opacity: 1, x: 168, y: 115, rotate: 0 },
        )}
      >
        <MiniCover book={hobbit} className="h-[75px] w-[50px]" />
      </motion.div>
    </div>
  )
}

function Star({ index, loop }: { index: number; loop: ReturnType<typeof useLoop>['loop'] }) {
  const on = 0.12 + index * 0.07
  return (
    <svg viewBox="0 0 24 24" className="size-6">
      <path
        d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"
        fill="none"
        stroke="#b08a3a"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <motion.path
        d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"
        fill={CRAYON.marigold}
        style={{ transformOrigin: '12px 12px' }}
        {...loop(
          { scale: [0, 0, 1.25, 1, 1, 0] },
          [0, on, on + 0.04, on + 0.08, 0.92, 1].map((x) => Math.min(x, 1)),
          { scale: 1 },
        )}
      />
    </svg>
  )
}

function AnnotateScene() {
  const { ref, loop } = useLoop(7)
  const piranesi = byTitle('Piranesi')
  return (
    <div ref={ref} aria-hidden className="relative mx-auto h-[280px] w-[300px] max-sm:[zoom:0.92]">
      <div
        className="absolute inset-x-3 top-3 bottom-4 -rotate-2 rounded-md text-[#2a1e16] shadow-[0_18px_30px_-18px_rgb(0_0_0/0.55)]"
        style={{
          background:
            'linear-gradient(#d65a5a, #d65a5a) 0 52px / 100% 1.5px no-repeat, repeating-linear-gradient(180deg, transparent 0 25px, rgb(90 130 170 / 0.28) 25px 26px) 0 60px / 100% calc(100% - 60px) no-repeat, linear-gradient(180deg, #fdf8ec, #f5ead3)',
        }}
      >
        <MiniCover book={piranesi} className="absolute top-3 left-4 h-[66px] w-[44px]" />
        <p className="absolute top-3 left-[72px] font-display text-xl leading-tight">Piranesi</p>
        <p className="absolute top-10 left-[72px] text-xs text-[#6b5844]">Susanna Clarke</p>
        <div className="absolute top-[88px] left-4 flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} index={i} loop={loop} />
          ))}
        </div>
        <p className="absolute top-[122px] left-4 font-mono text-[11px] text-[#5b4a3c]">
          started &nbsp; 2 March
        </p>
        <motion.p
          className="absolute top-[148px] left-4 font-mono text-[11px] text-[#5b4a3c]"
          {...loop(
            {
              clipPath: [
                'inset(0 100% 0 0)',
                'inset(0 100% 0 0)',
                'inset(0 0% 0 0)',
                'inset(0 0% 0 0)',
                'inset(0 100% 0 0)',
              ],
            },
            [0, 0.5, 0.58, 0.92, 1],
            { clipPath: 'inset(0 0% 0 0)' },
          )}
        >
          finished 19 March
        </motion.p>
        <motion.p
          className="absolute top-[178px] left-6 -rotate-3 font-hand text-xl text-[#3e5a3a]"
          {...loop(
            {
              clipPath: [
                'inset(0 100% 0 0)',
                'inset(0 100% 0 0)',
                'inset(0 0% 0 0)',
                'inset(0 0% 0 0)',
                'inset(0 100% 0 0)',
              ],
            },
            [0, 0.6, 0.74, 0.92, 1],
            { clipPath: 'inset(0 0% 0 0)' },
          )}
        >
          “the beauty of the house is immeasurable”
        </motion.p>
        {/* the stamp, thumped down once the book is finished */}
        <motion.div
          className="absolute top-[104px] right-5 rounded-md border-[3px] border-[#a8443c] px-2.5 py-0.5 font-display text-lg font-semibold tracking-[0.2em] text-[#a8443c] mix-blend-multiply"
          style={{ rotate: -12 }}
          {...loop(
            { scale: [2.4, 2.4, 0.9, 1, 1, 1], opacity: [0, 0, 0.95, 0.85, 0.85, 0] },
            [0, 0.5, 0.55, 0.6, 0.92, 1],
            { scale: 1, opacity: 0.85 },
          )}
        >
          READ
        </motion.div>
      </div>
    </div>
  )
}

function Counter({ to, run }: { to: number; run: boolean }) {
  const value = useMotionValue(run ? 0 : to)
  const text = useTransform(value, (v) => String(Math.round(v)))
  useEffect(() => {
    if (!run) {
      value.set(to)
      return
    }
    value.set(0)
    const controls = animate(value, to, { duration: 2.2, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [run, to, value])
  return <motion.span>{text}</motion.span>
}

function GrowScene() {
  const { ref, inView, reduce } = useLoop(8)
  const [round, setRound] = useState(0)
  const playing = inView && !reduce
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setRound((r) => r + 1), 8000)
    return () => window.clearInterval(id)
  }, [playing])
  const colours = [
    CRAYON.rose,
    CRAYON.marigold,
    CRAYON.lilac,
    CRAYON.sky,
    CRAYON.coral,
    CRAYON.butter,
  ]
  return (
    <div ref={ref} aria-hidden className="relative mx-auto h-[280px] w-[300px] max-sm:[zoom:0.92]">
      <div className="absolute top-2 left-3">
        <p className="font-display text-[64px] leading-none font-medium tracking-tight text-ink tabular-nums">
          {playing ? <Counter key={round} to={12} run /> : 12}
          <span className="text-[32px] text-ink-faint">/24</span>
        </p>
        <p className="mt-1 font-hand text-lg text-ink-soft">books this year</p>
      </div>
      <motion.div
        className="absolute top-0 right-2 w-[92px]"
        initial={false}
        animate={playing ? { y: [30, 0], opacity: [0, 1] } : { y: 0, opacity: 1 }}
        transition={{ duration: 1.4, ease: 'easeOut' }}
        key={`sun-${round}`}
      >
        <GoalSun progress={0.5} size={92} />
      </motion.div>
      <div
        key={round}
        className="absolute inset-x-3 bottom-[22px] flex h-[130px] items-end justify-around"
      >
        {colours.map((color, i) => (
          <Flower
            key={color}
            color={color}
            seed={`grow-${i}`}
            height={70 + ((i * 23) % 50)}
            delay={playing ? 0.3 + i * 0.22 : 0}
            className="h-full w-10"
          />
        ))}
      </div>
      <div className="absolute inset-x-1 bottom-2 h-6 rounded-[50%] bg-[#8a5a3b] shadow-[inset_0_3px_0_rgb(0_0_0/0.15)]" />
    </div>
  )
}

const SCENES: ReactNode[] = [
  <ShelveScene key="shelve" />,
  <AnnotateScene key="annotate" />,
  <GrowScene key="grow" />,
]
const TINTS = ['chapter-sage', 'chapter-butter', 'chapter-rose']

/** Three overlapping dots, the little mark on each card's label. */
function Dots() {
  return (
    <span aria-hidden className="flex">
      {[CRAYON.leaf, CRAYON.marigold, CRAYON.rose].map((colour, i) => (
        <span
          key={colour}
          className="size-3 rounded-full border border-[#3a2a20]/40"
          style={{ background: colour, marginLeft: i ? -4 : 0 }}
        />
      ))}
    </span>
  )
}

export function Chapters() {
  return (
    <section
      aria-labelledby="how-heading"
      className="mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32"
    >
      <p className="font-hand text-2xl text-moss">how it works</p>
      <h2
        id="how-heading"
        className="mt-2 max-w-3xl font-display text-[clamp(2.4rem,5.5vw,4.2rem)] leading-[1] font-medium tracking-[-0.02em] text-balance"
      >
        <span className="block">{HOME.howHeadline[0]}</span>
        <span className="block text-moss italic">{HOME.howHeadline[1]}</span>
      </h2>
      <ol className="mt-14 flex flex-col gap-6 md:gap-[14vh]">
        {HOME.chapters.map((chapter, i) => (
          <li
            key={chapter.title}
            className={`chapter-card ${TINTS[i]} grid items-center gap-8 rounded-[2rem] border border-line p-6 sm:p-10 md:sticky md:grid-cols-[1.1fr_1fr] md:p-14`}
            style={{ top: `calc(5.5rem + ${i * 1.75}rem)` }}
          >
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-card/70 py-1 pr-3.5 pl-2 text-sm font-medium text-ink">
                <Dots />
                <span className="font-hand text-base text-ink-soft">{chapter.numeral}</span>
                {chapter.title}
              </span>
              <h3 className="mt-5 font-display text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.04] font-medium tracking-[-0.015em] text-balance">
                <span className="block text-ink">{chapter.headline[0]}</span>
                <span className="chapter-accent block italic">{chapter.headline[1]}</span>
              </h3>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">{chapter.text}</p>
            </div>
            <div className="rounded-[1.5rem] bg-paper/60 py-6">{SCENES[i]}</div>
          </li>
        ))}
      </ol>
    </section>
  )
}
