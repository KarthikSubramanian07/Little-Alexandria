import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { motion } from 'motion/react'
import { AlertDialog, DropdownMenu } from 'radix-ui'
import { useEffect, useState, type ReactNode } from 'react'
import type { User } from '../../shared/types'
import { snappy } from '../lib/motion'
import { api } from '../lib/api'
import { useSignOut } from '../lib/queries'
import { useTheme, type ThemeChoice } from '../lib/theme'
import { ShareDialog } from './ShareDialog'
import { Wordmark } from './Wordmark'

const NAV = [
  {
    to: '/library',
    label: 'Shelves',
    icon: 'M4 5h3v14H4zM9 7h3v12H9zM14.5 6.2l2.8-.8 3.6 13.4-2.8.8zM2.5 20.5h19',
  },
  {
    to: '/garden',
    label: 'Garden',
    icon: 'M12 21v-8M12 13c-4 0-6-2.5-6-6 4 0 6 2.5 6 6zm0 0c4 0 6-2.5 6-6-4 0-6 2.5-6 6zM5 21h14',
  },
  {
    to: '/discover',
    label: 'Discover',
    icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm3.5 5.5-2 5-5 2 2-5z',
  },
] as const

export function AppShell({
  user,
  onSearch,
  children,
}: {
  user: User
  onSearch?: () => void
  children: ReactNode
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [sharing, setSharing] = useState(false)

  // ⌘K or "/" opens search from anywhere, unless you're typing.
  useEffect(() => {
    if (!onSearch) return
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, [contenteditable]')
      if (
        (event.key === 'k' && (event.metaKey || event.ctrlKey)) ||
        (event.key === '/' && !typing)
      ) {
        event.preventDefault()
        onSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSearch])

  return (
    <div className="min-h-dvh pb-28 sm:pb-24">
      <a
        href="#main"
        className="sr-only rounded bg-moss px-3 py-2 text-on-moss focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70]"
      >
        Skip to your shelves
      </a>
      <header className="sticky top-0 z-30 bg-[color-mix(in_oklab,var(--paper)_86%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-8 sm:py-4">
          <Link
            to="/library"
            className="flex shrink-0 items-center rounded-lg pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            aria-label="Little Alexandria, your shelves"
          >
            {/* Tablets need the room for the nav and search, so the name waits for laptops. */}
            <Wordmark nameFrom="lg" />
          </Link>
          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 rounded-full border border-line p-1 sm:flex"
          >
            {NAV.map((item) => {
              const active = pathname.startsWith(item.to)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={clsx(
                    'relative rounded-full px-4 py-1 text-sm font-medium whitespace-nowrap transition-colors pointer-coarse:py-2.5',
                    active ? 'text-on-moss' : 'text-ink-soft hover:text-ink',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      transition={snappy}
                      className="absolute inset-0 rounded-full bg-moss"
                    />
                  )}
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
                aria-keyshortcuts="Meta+K Control+K"
                className="group flex shrink-0 items-center gap-2 rounded-full border border-line-strong bg-card py-2 pr-2 pl-2 text-sm whitespace-nowrap text-ink-soft transition hover:border-moss hover:text-ink active:scale-[0.98] pointer-coarse:p-3 lg:py-1.5 lg:pl-4"
              >
                <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                  <circle
                    cx="8.5"
                    cy="8.5"
                    r="5.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M13 13 L17 17"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="sr-only lg:not-sr-only">Find a book</span>
                <kbd
                  aria-hidden
                  className="hidden rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-faint lg:inline pointer-coarse:lg:hidden"
                >
                  ⌘K
                </kbd>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSharing(true)}
              aria-label="Share your shelves"
              className="hidden size-9 shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-paper-deep hover:text-ink active:scale-90 pointer-coarse:size-11 sm:grid"
            >
              <svg viewBox="0 0 20 20" className="size-[18px]" aria-hidden>
                <g
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 2.5v10M6.5 6 10 2.5 13.5 6" />
                  <path d="M5 9.5H4a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 4 17.5h12a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 16 9.5h-1" />
                </g>
              </svg>
            </button>
            <ThemeToggle />
            <UserMenu user={user} onShare={() => setSharing(true)} />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 pt-6 sm:px-8 sm:pt-10">
        {children}
      </main>

      {/* On phones the pages live in a tab bar, where thumbs already are. */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex items-center justify-around rounded-full border border-line bg-[color-mix(in_oklab,var(--card)_92%,transparent)] p-1.5 shadow-[0_18px_40px_-16px_rgb(var(--shadow-rgb)/0.55)] backdrop-blur-md sm:hidden"
      >
        {NAV.map((item) => {
          const active = pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'relative flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] font-medium transition-colors',
                active ? 'text-on-moss' : 'text-ink-soft',
              )}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  transition={snappy}
                  className="absolute inset-0 rounded-full bg-moss"
                />
              )}
              <svg viewBox="0 0 24 24" className="relative size-5" aria-hidden>
                <path
                  d={item.icon}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="relative">{item.label}</span>
            </Link>
          )
        })}
      </nav>
      {sharing && <ShareDialog user={user} open={sharing} onOpenChange={setSharing} />}
    </div>
  )
}

const THEME_ORDER: ThemeChoice[] = ['light', 'dark', 'system']
const THEME_LABEL: Record<ThemeChoice, string> = {
  light: 'Daylight',
  dark: 'Library at night',
  system: 'Match my device',
}

export function ThemeToggle() {
  const { choice, resolved, setChoice } = useTheme()
  const next = THEME_ORDER[(THEME_ORDER.indexOf(choice) + 1) % THEME_ORDER.length]!
  return (
    <button
      type="button"
      onClick={() => setChoice(next)}
      title={`${THEME_LABEL[choice]}. Switch to ${THEME_LABEL[next].toLowerCase()}`}
      aria-label={`Theme: ${THEME_LABEL[choice]}. Switch to ${THEME_LABEL[next]}`}
      className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-paper-deep hover:text-ink active:scale-90 pointer-coarse:size-11"
    >
      <motion.svg
        key={resolved + choice}
        viewBox="0 0 24 24"
        className="size-5"
        initial={{ rotate: -40, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={snappy}
        aria-hidden
      >
        {resolved === 'dark' ? (
          <path
            d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
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

const menuItem =
  'block cursor-pointer rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-moss data-[highlighted]:text-on-moss'

function UserMenu({ user, onShare }: { user: User; onShare: () => void }) {
  const signOut = useSignOut()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [deleting, setDeleting] = useState(false)
  const initial = user.name.trim().slice(0, 1).toUpperCase() || 'R'
  const leave = () => {
    client.clear()
    void navigate({ to: '/' })
  }
  return (
    <>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger
          aria-label={`Signed in as ${user.name}`}
          className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-line-strong pointer-coarse:size-11 bg-moss-soft font-display text-sm font-semibold text-moss transition hover:border-moss active:scale-95"
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            initial
          )}
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="z-50 min-w-60 rounded-xl border border-line bg-card p-1.5 shadow-[0_18px_40px_-14px_rgb(var(--shadow-rgb)/0.45)] data-[state=open]:animate-[menu-in_160ms_var(--ease-out-soft)]"
          >
            <div className="px-3 pt-2 pb-2.5">
              <p className="font-display font-medium">{user.name}</p>
              {user.email && <p className="truncate text-xs text-ink-faint">{user.email}</p>}
            </div>
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <DropdownMenu.Item className={menuItem} onSelect={onShare}>
              Share your shelves
            </DropdownMenu.Item>
            <DropdownMenu.Item className={menuItem} asChild>
              <a href="/api/export" download>
                Download my library <span className="text-ink-faint">(CSV)</span>
              </a>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={menuItem}
              onSelect={() => signOut.mutate(undefined, { onSuccess: leave })}
            >
              Close the library <span className="text-ink-faint">(sign out)</span>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <DropdownMenu.Item
              className={`${menuItem} text-rose data-[highlighted]:bg-rose data-[highlighted]:text-paper`}
              onSelect={() => setDeleting(true)}
            >
              Delete my account…
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <DeleteAccount open={deleting} onOpenChange={setDeleting} onDeleted={leave} />
    </>
  )
}

/** Deleting is forever, so it asks once, plainly, and offers the export first. */
function DeleteAccount({
  open,
  onOpenChange,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-[rgb(var(--shadow-rgb)/0.4)] backdrop-blur-[3px]" />
        <AlertDialog.Content className="fixed inset-x-3 top-[18dvh] z-50 mx-auto max-w-md rounded-2xl border border-line bg-card p-6 shadow-[0_40px_80px_-30px_rgb(var(--shadow-rgb)/0.6)] data-[state=open]:animate-[dialog-in_260ms_var(--ease-out-soft)]">
          <AlertDialog.Title className="font-display text-2xl font-medium">
            Close your library for good?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-ink-soft">
            Your shelves, ratings, notes, goals, and shared page will be deleted, and this can’t be
            undone.{' '}
            <a href="/api/export" download className="text-moss underline underline-offset-4">
              Download a copy first
            </a>
            .
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel className="rounded-full px-4 py-2 text-sm font-medium hover:bg-paper-deep">
              Keep my library
            </AlertDialog.Cancel>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await api.deleteAccount()
                  onOpenChange(false)
                  onDeleted()
                } finally {
                  setBusy(false)
                }
              }}
              className="rounded-full bg-rose px-4 py-2 text-sm font-medium text-paper disabled:opacity-60"
            >
              {busy ? 'Closing…' : 'Delete everything'}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
