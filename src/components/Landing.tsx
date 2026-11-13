import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import type { User } from '../../shared/types'
import { api } from '../lib/api'
import { meQuery } from '../lib/queries'
import { Flower } from './art/Flower'
import { CRAYON } from './art/palette'
import { GoalSun, OvergrownBookcase, PotWithSprout, WateringCan } from './art/scenes'
import { ThemeToggle } from './AppShell'
import { Wordmark } from './Wordmark'

const ERRORS: Record<string, string> = {
  sign_in_failed: 'That sign-in didn’t take. Mind trying once more?',
  google_unconfigured: 'Google sign-in isn’t switched on here yet.',
}

export function Landing({ user, error }: { user: User | null; error?: string }) {
  const reduce = useReducedMotion()
  const { data: providers } = useQuery({ queryKey: ['providers'], queryFn: api.providers, staleTime: Infinity })
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
      : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { type: 'spring' as const, stiffness: 160, damping: 22, delay } }

  return (
    <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
      <header className="flex items-center justify-between py-5">
        <Wordmark />
        <ThemeToggle />
      </header>

      <main>
        <section className="grid items-center gap-10 pt-6 pb-20 md:grid-cols-[1.1fr_1fr] md:pt-14 md:pb-28">
          <div>
            <motion.p {...rise(0.05)} className="font-hand text-2xl text-moss">
              a reading room, planted by you
            </motion.p>
            <motion.h1
              {...rise(0.12)}
              className="mt-3 font-display text-[clamp(2.75rem,7vw,5.4rem)] leading-[0.95] font-medium tracking-[-0.025em] text-balance"
            >
              Every great reader deserves a <span className="ink-underline italic">great library</span>.
            </motion.h1>
            <motion.p {...rise(0.2)} className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
              Little Alexandria is a warm, hand-drawn home for the books you want to read, the one on your
              nightstand, and the ones you’ve loved. Shelve them, scribble in the margins, and watch a garden grow
              from everything you finish.
            </motion.p>

            <motion.div {...rise(0.28)} className="mt-9 flex flex-wrap items-center gap-3">
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
                      {entering ? 'Unlocking the doors…' : 'Look around as a guest'}
                    </button>
                  )}
                </>
              )}
            </motion.div>
            {error && ERRORS[error] && (
              <p role="alert" className="mt-4 font-hand text-lg text-rose">
                {ERRORS[error]}
              </p>
            )}
            {!user && (
              <motion.p {...rise(0.36)} className="mt-5 text-sm text-ink-faint">
                Free, private to you, and no newsletter. Your shelves are yours alone.
              </motion.p>
            )}
          </div>

          <motion.div
            className="relative mx-auto aspect-[22/24] w-full max-w-[460px]"
            initial={reduce ? undefined : { opacity: 0, scale: 0.96, rotate: 1.5 }}
            animate={reduce ? undefined : { opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 90, damping: 18, delay: 0.1 }}
          >
            <div className="absolute -top-6 -right-4 w-24 opacity-90 sm:w-28">
              <GoalSun progress={0.62} size={112} />
            </div>
            <OvergrownBookcase />
            <p className="absolute bottom-[-0.5rem] left-2 rotate-[-4deg] font-hand text-lg text-ink-faint">
              ↑ yours, give or take a few hundred books
            </p>
          </motion.div>
        </section>

        <section aria-labelledby="how-heading" className="border-t border-line py-20">
          <h2 id="how-heading" className="sr-only">
            How it works
          </h2>
          <ol className="grid gap-12 md:grid-cols-3 md:gap-10">
            <Chapter
              numeral="i."
              title="Shelve"
              art={<PotWithSprout />}
              text="Search every book in the stacks and set it on a shelf in one click: Want to Read, Currently Reading, or Read. Drag books between shelves like you would at home."
            />
            <Chapter
              numeral="ii."
              title="Annotate"
              art={<WateringCan />}
              text="Each book opens into its own catalogue card. Give it stars, note the day you started and finished, and keep notes in the margin."
            />
            <Chapter
              numeral="iii."
              title="Grow"
              art={
                <div className="flex h-full items-end justify-center gap-1">
                  {[CRAYON.rose, CRAYON.marigold, CRAYON.lilac, CRAYON.coral].map((color, i) => (
                    <Flower key={color} color={color} seed={`chapter-${i}`} height={60 + i * 12} delay={i * 0.15} className="h-full w-8" />
                  ))}
                </div>
              }
              text="Every finished book plants a flower in your reading garden, coloured like its cover. Set a yearly goal and watch the sun come up."
            />
          </ol>
        </section>

        <section className="border-t border-line py-20 text-center">
          <blockquote className="mx-auto max-w-2xl">
            <p className="font-display text-[clamp(1.6rem,3.6vw,2.4rem)] leading-tight font-light italic text-balance">
              “If you have a garden and a library, you have everything you need.”
            </p>
            <footer className="mt-4 font-hand text-xl text-ink-soft">Marcus Tullius Cicero, who would have liked this place</footer>
          </blockquote>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-8 text-sm text-ink-faint">
        <p>Little Alexandria · made by hand, with love for libraries</p>
        <p>
          Book data from{' '}
          <a className="underline underline-offset-4 hover:text-ink" href="https://openlibrary.org" rel="noreferrer">
            Open Library
          </a>{' '}
          and Google Books
        </p>
      </footer>
    </div>
  )
}

function Chapter({ numeral, title, text, art }: { numeral: string; title: string; text: string; art: React.ReactNode }) {
  return (
    <li className="flex flex-col">
      <div className="mb-6 h-28 w-32">{art}</div>
      <p className="font-hand text-2xl text-moss">{numeral}</p>
      <h3 className="mt-1 font-display text-3xl font-medium tracking-tight">{title}</h3>
      <p className="mt-3 max-w-sm leading-relaxed text-ink-soft">{text}</p>
    </li>
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
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z" />
      </svg>
      Sign in with Google
    </a>
  )
}
