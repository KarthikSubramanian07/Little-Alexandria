import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { motion } from 'motion/react'
import { DropdownMenu } from 'radix-ui'
import { useEffect, useState, type ReactNode } from 'react'
import type { User } from '../../shared/types'
import { snappy } from '../lib/motion'
import { useSignOut } from '../lib/queries'
import { useTheme, type ThemeChoice } from '../lib/theme'
import { ShareDialog } from './ShareDialog'
import { Wordmark } from './Wordmark'

const NAV = [
  { to: '/library', label: 'Shelves' },
  { to: '/garden', label: 'Garden' },
  { to: '/discover', label: 'Discover' },
] as const

export function AppShell({ user, onSearch, children }: { user: User; onSearch?: () => void; children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  // ⌘K or "/" opens search from anywhere, unless you're typing.
  useEffect(() => {
    if (!onSearch) return
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]')
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
        event.preventDefault()
        onSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSearch])

  return (
    <div className="min-h-dvh pb-24">
      <a href="#main" className="sr-only rounded bg-moss px-3 py-2 text-on-moss focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70]">
        Skip to your shelves
      </a>
      <header className="sticky top-0 z-30 border-b border-transparent bg-[color-mix(in_oklab,var(--paper)_86%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-8 sm:py-4">
        <Link to="/library" className="shrink-0" aria-label="Little Alexandria, your shelves">
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 rounded-full border border-line p-1">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={clsx('relative rounded-full px-3 py-1 text-sm font-medium transition-colors sm:px-4', active ? 'text-on-moss' : 'text-ink-soft hover:text-ink')}
                aria-current={active ? 'page' : undefined}
              >
                {active && <motion.span layoutId="nav-pill" transition={snappy} className="absolute inset-0 rounded-full bg-moss" />}
                <span className="relative">{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {onSearch && (
            <button
              type="button"
              onClick={onSearch}
              className="group flex items-center gap-2 rounded-full border border-line-strong bg-card py-1.5 pr-1.5 pl-3 text-sm text-ink-soft transition hover:border-moss hover:text-ink active:scale-[0.98] sm:pr-2 sm:pl-4"
            >
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M13 13 L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span className="hidden sm:inline">Find a book</span>
              <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-faint md:inline">⌘K</kbd>
            </button>
          )}
          <ShareButton user={user} />
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 pt-6 sm:px-8 sm:pt-10">
        {children}
      </main>
    </div>
  )
}

const THEME_ORDER: ThemeChoice[] = ['light', 'dark', 'system']
const THEME_LABEL: Record<ThemeChoice, string> = { light: 'Daylight', dark: 'Library at night', system: 'Match my device' }

export function ThemeToggle() {
  const { choice, resolved, setChoice } = useTheme()
  const next = THEME_ORDER[(THEME_ORDER.indexOf(choice) + 1) % THEME_ORDER.length]!
  return (
    <button
      type="button"
      onClick={() => setChoice(next)}
      title={`${THEME_LABEL[choice]}. Switch to ${THEME_LABEL[next].toLowerCase()}`}
      aria-label={`Theme: ${THEME_LABEL[choice]}. Switch to ${THEME_LABEL[next]}`}
      className="grid size-9 place-items-center rounded-full text-ink-soft transition hover:bg-paper-deep hover:text-ink active:scale-90"
    >
      <motion.svg key={resolved + choice} viewBox="0 0 24 24" className="size-5" initial={{ rotate: -40, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={snappy} aria-hidden>
        {resolved === 'dark' ? (
          <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        ) : (
          <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
          </g>
        )}
        {choice === 'system' && <circle cx="19" cy="5" r="2.2" fill="currentColor" />}
      </motion.svg>
    </button>
  )
}

function UserMenu({ user }: { user: User }) {
  const signOut = useSignOut()
  const navigate = useNavigate()
  const client = useQueryClient()
  const initial = user.name.trim().slice(0, 1).toUpperCase() || 'R'
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`Signed in as ${user.name}`}
        className="grid size-9 place-items-center overflow-hidden rounded-full border border-line-strong bg-moss-soft font-display text-sm font-semibold text-moss transition hover:border-moss active:scale-95"
      >
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : initial}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-56 rounded-xl border border-line bg-card p-1.5 shadow-[0_18px_40px_-14px_rgb(var(--shadow-rgb)/0.45)] data-[state=open]:animate-[menu-in_160ms_var(--ease-out-soft)]"
        >
          <div className="px-3 pt-2 pb-2.5">
            <p className="font-display font-medium">{user.name}</p>
            {user.email && <p className="truncate text-xs text-ink-faint">{user.email}</p>}
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            className="cursor-pointer rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-moss data-[highlighted]:text-on-moss"
            onSelect={() =>
              signOut.mutate(undefined, {
                onSuccess: () => {
                  client.clear()
                  void navigate({ to: '/' })
                },
              })
            }
          >
            Close the library <span className="text-ink-faint">(sign out)</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function ShareButton({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Share your shelves"
        className="grid size-9 place-items-center rounded-full text-ink-soft transition hover:bg-paper-deep hover:text-ink active:scale-90"
      >
        <svg viewBox="0 0 20 20" className="size-[18px]" aria-hidden>
          <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2.5v10M6.5 6 10 2.5 13.5 6" />
            <path d="M5 9.5H4a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 4 17.5h12a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 16 9.5h-1" />
          </g>
        </svg>
      </button>
      {open && <ShareDialog user={user} open={open} onOpenChange={setOpen} />}
    </>
  )
}
