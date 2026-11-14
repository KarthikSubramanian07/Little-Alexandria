import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { useRef, useState } from 'react'
import type { User } from '../../shared/types'
import { api } from '../lib/api'
import { meQuery } from '../lib/queries'
import { Flower } from './art/Flower'
import { CRAYON } from './art/palette'
import { Fireflies } from './art/scenes'
import { ThemeToggle } from './AppShell'
import { HOME } from '../../shared/site'
import { SiteFooter } from './DocPage'
import { Chapters } from './landing/Chapters'
import { CoverMarquee } from './landing/CoverMarquee'
import { ReadingRoom } from './landing/ReadingRoom'
import { Wordmark } from './Wordmark'

const ERRORS: Record<string, string> = {
  sign_in_failed: 'That sign-in didn’t take. Mind trying once more?',
  google_unconfigured: 'Google sign-in isn’t switched on here yet.',
}

export function Landing({ user, error }: { user: User | null; error?: string }) {
  const reduce = useReducedMotion()
  const { data: providers } = useQuery({
    queryKey: ['providers'],
    queryFn: api.providers,
    staleTime: Infinity,
  })
  const client = useQueryClient()
  const navigate = useNavigate()
  const [entering, setEntering] = useState(false)

  const enterAsGuest = async () => {
    setEntering(true)
    try {
      const { user: guest } = await api.guest()
      client.setQueryData(meQuery.queryKey, guest)
      await navigate({ to: '/library' })
    } finally {
      setEntering(false)
    }
  }

  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { type: 'spring' as const, stiffness: 160, damping: 22, delay },
        }

  const doors = (guestLabel: string) => (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {user ? (
        <Link
          to="/library"
          className="inline-flex items-center gap-2 rounded-full bg-moss px-6 py-3.5 text-base font-medium text-on-moss shadow-[0_10px_24px_-12px_var(--moss)] transition hover:brightness-110 active:scale-[0.98]"
        >
          Open your library <span aria-hidden>→</span>
        </Link>
      ) : (
        <>
          <GoogleButton disabled={providers ? !providers.google : false} />
          {providers?.guest && (
            <button
              type="button"
              onClick={() => void enterAsGuest()}
              disabled={entering}
              className="rounded-full px-5 py-3.5 text-base font-medium text-ink-soft underline decoration-line-strong decoration-1 underline-offset-[6px] transition hover:text-ink hover:decoration-moss disabled:opacity-60"
            >
              {entering ? 'Unlocking the doors…' : guestLabel}
            </button>
          )}
        </>
      )}
    </div>
  )

  return (
    <div className="relative">
      <header className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Wordmark />
        <ThemeToggle />
      </header>

      <main id="main">
        <ReadingRoom
          caption={
            <div className="flex items-start gap-1 text-ink-faint">
              <p className="pt-1 font-hand text-base whitespace-nowrap sm:text-lg">
                {HOME.caption}
              </p>
              <HandArrow delay={reduce ? 0 : 1.4} />
            </div>
          }
        >
          <motion.p {...rise(0.05)} className="font-hand text-2xl text-moss">
            {HOME.kicker}
          </motion.p>
          <motion.h1
            {...rise(0.12)}
            className="mx-auto mt-3 max-w-4xl font-display text-[clamp(2.75rem,7.4vw,6rem)] leading-[0.95] font-medium tracking-[-0.03em] text-balance"
          >
            {HOME.titleLead}
            <span className="ink-underline italic">{HOME.titleEmphasis}</span>.
          </motion.h1>
          <motion.p
            {...rise(0.2)}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft"
          >
            {HOME.intro}
          </motion.p>
          <motion.div {...rise(0.28)} className="mt-9">
            {doors('Look around as a guest')}
          </motion.div>
          {error && ERRORS[error] && (
            <p role="alert" className="mt-4 font-hand text-lg text-rose">
              {ERRORS[error]}
            </p>
          )}
          {!user && (
            <motion.p {...rise(0.36)} className="mt-5 text-sm text-ink-faint">
              {HOME.promise}
            </motion.p>
          )}
        </ReadingRoom>

        <CoverMarquee />
        <Chapters />

        <section className="mx-auto max-w-6xl border-t border-line px-5 py-20 text-center sm:px-8">
          <blockquote className="mx-auto max-w-2xl">
            <p className="font-display text-[clamp(1.6rem,3.6vw,2.4rem)] leading-tight font-light italic text-balance">
              {HOME.quote.text}
            </p>
            <footer className="mt-4 font-hand text-xl text-ink-soft">{HOME.quote.cite}</footer>
          </blockquote>
        </section>

        <section aria-labelledby="closing-heading" className="px-3 pb-16 sm:px-8">
          <div className="closing-band relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:py-20">
            <Fireflies count={10} />
            <h2
              id="closing-heading"
              className="relative font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-[1] font-medium tracking-[-0.02em]"
            >
              <span className="block">{HOME.closing[0]}</span>
              <span className="block text-moss italic">{HOME.closing[1]}</span>
            </h2>
            <div className="relative mt-9">{doors('Step inside as a guest')}</div>
            <ClosingGarden />
          </div>
        </section>
      </main>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SiteFooter />
      </div>
    </div>
  )
}

/** A row of flowers along the bottom of the closing card, grown once it scrolls into view. */
function ClosingGarden() {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, { once: true, amount: 0.5 })
  const colours = [
    CRAYON.rose,
    CRAYON.marigold,
    CRAYON.lilac,
    CRAYON.coral,
    CRAYON.sky,
    CRAYON.butter,
    CRAYON.rose,
    CRAYON.lilac,
  ]
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none mt-10 -mb-16 flex h-24 items-end justify-center gap-3 sm:-mb-20 sm:gap-6"
    >
      {seen &&
        colours.map((color, i) => (
          <Flower
            key={i}
            color={color}
            seed={`closing-${i}`}
            height={60 + ((i * 29) % 60)}
            delay={i * 0.12}
            className="h-full w-8"
          />
        ))}
    </div>
  )
}

/** A crayon arrow that curls from the caption down into the bookcase. */
function HandArrow({ delay }: { delay: number }) {
  const draw = (start: number) =>
    delay
      ? {
          initial: { pathLength: 0 },
          animate: { pathLength: 1 },
          transition: { duration: 0.55, ease: 'easeOut' as const, delay: delay + start },
        }
      : {}
  return (
    <svg viewBox="0 0 56 64" className="h-14 w-12 shrink-0" aria-hidden fill="none">
      <g
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#la-wobble)"
      >
        <motion.path d="M4 12 C 26 4, 46 18, 42 54" {...draw(0)} />
        <motion.path d="M34.5 45.5 L42 55 L48.5 45" {...draw(0.45)} />
      </g>
    </svg>
  )
}

/** Google's sign-in button, following their branding: the four-colour G on a neutral pill. */
function GoogleButton({ disabled }: { disabled: boolean }) {
  return (
    <a
      href="/api/auth/google"
      aria-disabled={disabled || undefined}
      onClick={(event) => disabled && event.preventDefault()}
      className="inline-flex items-center gap-3 rounded-full border border-line-strong bg-card py-3 pr-6 pl-4 text-base font-medium text-ink shadow-[0_10px_30px_-18px_rgb(var(--shadow-rgb)/0.6)] transition hover:-translate-y-0.5 hover:border-ink-faint active:translate-y-0 active:scale-[0.98] aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      title={disabled ? 'Google sign-in isn’t configured yet' : undefined}
    >
      <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z"
        />
      </svg>
      Sign in with Google
    </a>
  )
}
