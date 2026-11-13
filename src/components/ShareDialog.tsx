import { useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { motion } from 'motion/react'
import { Dialog } from 'radix-ui'
import { useState } from 'react'
import { handleSchema } from '../../shared/schemas'
import type { User } from '../../shared/types'
import { api } from '../lib/api'
import { snappy } from '../lib/motion'
import { meQuery } from '../lib/queries'
import { toast } from '../lib/toast'

export const shareUrl = (handle: string) => `${window.location.origin}/u/${handle}`

/**
 * Turn sharing on, pick an address, and send it. Shelves, stars, and the
 * garden are shared; notes and email never are.
 */
export function ShareDialog({ user, open, onOpenChange }: { user: User; open: boolean; onOpenChange: (open: boolean) => void }) {
  const client = useQueryClient()
  const [handle, setHandle] = useState(user.handle)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const url = shareUrl(user.handle)

  const save = async (changes: { handle?: string; isPublic?: boolean }) => {
    setSaving(true)
    setError(null)
    try {
      const { user: next } = await api.updateProfile(changes)
      client.setQueryData(meQuery.queryKey, next)
      setHandle(next.handle)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save that')
    } finally {
      setSaving(false)
    }
  }

  const share = async () => {
    const data = { title: `${user.name.split(' ')[0]}’s library`, text: 'Have a look at my bookshelf on Little Alexandria', url }
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      await navigator.share(data).catch(() => undefined)
      return
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Link copied. Go on, show it off.')
    setTimeout(() => setCopied(false), 1800)
  }

  const handleError = handle !== user.handle ? handleSchema.safeParse(handle).error?.issues[0]?.message : undefined

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(var(--shadow-rgb)/0.35)] backdrop-blur-[3px] data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content className="fixed inset-x-3 top-[12dvh] z-50 mx-auto max-w-md rounded-2xl border border-line bg-card p-6 shadow-[0_40px_80px_-30px_rgb(var(--shadow-rgb)/0.6)] data-[state=open]:animate-[dialog-in_260ms_var(--ease-out-soft)]">
          <Dialog.Title className="font-display text-2xl font-medium tracking-tight">Share your shelves</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-ink-soft">
            Anyone with the link can browse your shelves, stars, and garden. Your notes stay yours.
          </Dialog.Description>

          <button
            type="button"
            role="switch"
            aria-checked={user.isPublic}
            disabled={saving}
            onClick={() => void save({ isPublic: !user.isPublic })}
            className="mt-6 flex w-full items-center justify-between gap-4 rounded-xl border border-line px-4 py-3 text-left transition hover:border-line-strong"
          >
            <span>
              <span className="block font-medium">{user.isPublic ? 'Your library is open' : 'Your library is private'}</span>
              <span className="block font-hand text-base text-ink-faint">
                {user.isPublic ? 'the doors are open, come on in' : 'only you can see it right now'}
              </span>
            </span>
            <span className={clsx('relative h-7 w-12 shrink-0 rounded-full transition-colors', user.isPublic ? 'bg-moss' : 'bg-line-strong')}>
              <motion.span
                className="absolute top-1 size-5 rounded-full bg-card shadow"
                animate={{ left: user.isPublic ? 24 : 4 }}
                transition={snappy}
              />
            </span>
          </button>

          <form
            className="mt-5"
            onSubmit={(event) => {
              event.preventDefault()
              if (!handleError && handle !== user.handle) void save({ handle })
            }}
          >
            <label htmlFor="handle" className="font-hand text-lg text-ink-soft">
              Your address
            </label>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center rounded-xl border border-line-strong bg-paper px-3 focus-within:border-moss">
                <span className="shrink-0 font-mono text-sm text-ink-faint">/u/</span>
                <input
                  id="handle"
                  value={handle}
                  onChange={(event) => setHandle(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  maxLength={30}
                  className="min-w-0 flex-1 bg-transparent py-2 font-mono text-sm outline-none"
                  spellCheck={false}
                  autoCapitalize="off"
                />
              </div>
              {handle !== user.handle && (
                <button type="submit" disabled={saving || Boolean(handleError)} className="rounded-full bg-moss px-4 py-2 text-sm font-medium text-on-moss disabled:opacity-40">
                  Save
                </button>
              )}
            </div>
            {(handleError || error) && <p className="mt-1.5 text-sm text-rose">{handleError ?? error}</p>}
          </form>

          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              disabled={!user.isPublic}
              onClick={() => void share()}
              className="flex-1 rounded-full bg-moss px-5 py-3 font-medium text-on-moss transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
            >
              {copied ? 'Copied ✓' : 'Copy link'}
            </button>
            {user.isPublic && (
              <a href={url} target="_blank" rel="noreferrer" className="rounded-full border border-line-strong px-5 py-3 text-sm font-medium hover:border-moss">
                Preview
              </a>
            )}
          </div>
          {!user.isPublic && <p className="mt-2 text-center font-hand text-base text-ink-faint">open your library to get a link</p>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
