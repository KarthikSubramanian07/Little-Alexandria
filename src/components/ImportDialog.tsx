import { useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { Dialog } from 'radix-ui'
import { useRef, useState, type DragEvent } from 'react'
import { mergeRows, parseReadingList, type ParsedList } from '../../shared/import'
import { SHELF_LABELS, SHELVES, type ImportRow, type User } from '../../shared/types'
import { importer, useImportState } from '../lib/importer'
import { snappy } from '../lib/motion'
import { SeedBed } from './art/scenes'

interface LoadedFile {
  name: string
  format: ParsedList['format']
  rows: ImportRow[]
}

const FORMAT_LABEL: Record<ParsedList['format'], string> = {
  goodreads: 'Goodreads export',
  storygraph: 'StoryGraph export',
  simple: 'Reading list',
}

export function ImportDialog({
  user,
  open,
  onOpenChange,
  onFind,
}: {
  user: User
  open: boolean
  onOpenChange: (open: boolean) => void
  onFind: (query: string) => void
}) {
  const client = useQueryClient()
  const progress = useImportState()
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const rows = mergeRows(files.flatMap((file) => file.rows))
  const counts = Object.fromEntries(SHELVES.map((shelf) => [shelf, rows.filter((row) => row.shelf === shelf).length]))

  const load = async (list: FileList | File[]) => {
    const loaded = await Promise.all(
      [...list]
        .filter((file) => /\.(csv|txt)$/i.test(file.name) || file.type === 'text/csv')
        .map(async (file) => {
          const parsed = parseReadingList(await file.text(), file.name)
          return { name: file.name, format: parsed.format, rows: parsed.rows }
        }),
    )
    setFiles((current) => [...current.filter((file) => !loaded.some((next) => next.name === file.name)), ...loaded])
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    void load(event.dataTransfer.files)
  }

  const busy = progress.status === 'running' || progress.status === 'paused' || progress.status === 'error'
  const done = progress.status === 'done'

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(var(--shadow-rgb)/0.35)] backdrop-blur-[3px] data-[state=open]:animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content className="fixed inset-x-3 top-[6dvh] z-50 mx-auto flex max-h-[88dvh] max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[0_40px_80px_-30px_rgb(var(--shadow-rgb)/0.6)] data-[state=open]:animate-[dialog-in_260ms_var(--ease-out-soft)]">
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <div>
              <Dialog.Title className="font-display text-2xl font-medium tracking-tight">
                {busy ? 'Shelving your books' : done ? 'All planted' : 'Bring your books with you'}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink-soft">
                {busy || done
                  ? 'Books appear on your shelves as they’re found. You can close this; it keeps going.'
                  : 'Drop in a Goodreads or StoryGraph export, or any list of “title, author”.'}
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="-mt-1 -mr-2 grid size-9 place-items-center rounded-full text-ink-soft hover:bg-paper-deep hover:text-ink">
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                <path d="M5 5 L15 15 M15 5 L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-6">
            {busy || done ? (
              <Progress
                onFind={(query) => {
                  onFind(query)
                  onOpenChange(false)
                }}
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={clsx(
                    'flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors',
                    dragging ? 'border-moss bg-moss-soft/60' : 'border-line-strong hover:border-moss',
                  )}
                >
                  <div className="h-20 w-28">
                    <SeedBed />
                  </div>
                  <span className="font-display text-lg">Drop CSV files here</span>
                  <span className="font-hand text-lg text-ink-faint">or click to choose them, as many as you like</span>
                </button>
                <input
                  ref={input}
                  type="file"
                  accept=".csv,text/csv,.txt"
                  multiple
                  hidden
                  onChange={(event) => event.target.files && void load(event.target.files)}
                />

                <AnimatePresence initial={false}>
                  {files.length > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
                        {files.map((file) => (
                          <li key={file.name} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                            <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
                            <span className="shrink-0 text-ink-faint">{FORMAT_LABEL[file.format]}</span>
                            <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums">{file.rows.length}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${file.name}`}
                              onClick={() => setFiles((current) => current.filter((other) => other.name !== file.name))}
                              className="shrink-0 rounded-full px-1.5 text-ink-faint hover:text-rose"
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-5 rounded-xl bg-paper-deep/60 p-4">
                        <p className="font-display text-lg">
                          {rows.length.toLocaleString()} {rows.length === 1 ? 'book' : 'books'}, ready to shelve
                        </p>
                        <p className="mt-1 text-sm text-ink-soft">
                          {SHELVES.filter((shelf) => counts[shelf]).map((shelf) => `${counts[shelf]} ${SHELF_LABELS[shelf]}`).join(' · ')}
                        </p>
                        <p className="mt-2 font-hand text-base text-ink-faint">
                          Duplicates across files are merged; a book you’ve read beats one you want to read.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <a
                    href="https://help.goodreads.com/s/article/How-do-I-import-or-export-my-books-1553870934590"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink"
                  >
                    How to export from Goodreads
                  </a>
                  <motion.button
                    type="button"
                    disabled={rows.length === 0}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      importer.start(client, user.id, rows)
                      setFiles([])
                    }}
                    className="rounded-full bg-moss px-5 py-2.5 font-medium text-on-moss transition hover:brightness-110 disabled:opacity-40"
                  >
                    Shelve {rows.length > 0 ? rows.length.toLocaleString() : ''} books
                  </motion.button>
                </div>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Progress({ onFind }: { onFind: (query: string) => void }) {
  const client = useQueryClient()
  const state = useImportState()
  const handled = state.added + state.existing + state.unmatched.length
  const fraction = state.total ? handled / state.total : 0
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="font-display text-3xl font-medium tabular-nums">
          {handled.toLocaleString()}
          <span className="text-lg text-ink-faint"> of {state.total.toLocaleString()}</span>
        </p>
        <p className="font-mono text-xs text-ink-faint">{Math.round(fraction * 100)}%</p>
      </div>
      <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-paper-deep" role="progressbar" aria-valuenow={handled} aria-valuemax={state.total} aria-label="Import progress">
        <motion.div className="h-full rounded-full bg-moss" animate={{ width: `${fraction * 100}%` }} transition={snappy} />
      </div>
      <p className="mt-3 h-6 truncate font-hand text-lg text-ink-soft" aria-live="polite">
        {state.status === 'paused'
          ? 'Paused. Your place is saved.'
          : state.status === 'error'
            ? state.error
            : state.status === 'done'
              ? 'Every book has found a shelf.'
              : state.latest
                ? `just shelved “${state.latest}”`
                : 'warming up the catalogue…'}
      </p>

      <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
        {[
          ['Shelved', state.added],
          ['Already there', state.existing],
          ['Not found', state.unmatched.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line px-2 py-3">
            <dd className="font-display text-2xl tabular-nums">{(value as number).toLocaleString()}</dd>
            <dt className="text-xs text-ink-soft">{label}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        {state.status === 'running' && (
          <button type="button" onClick={() => importer.pause()} className="rounded-full border border-line-strong px-4 py-2 text-sm hover:border-moss">
            Pause
          </button>
        )}
        {(state.status === 'paused' || state.status === 'error') && (
          <button type="button" onClick={() => importer.resume(client)} className="rounded-full bg-moss px-4 py-2 text-sm font-medium text-on-moss">
            Resume
          </button>
        )}
        {state.status !== 'done' ? (
          <button type="button" onClick={() => importer.cancel()} className="rounded-full px-4 py-2 text-sm text-ink-soft hover:text-rose">
            Stop importing
          </button>
        ) : (
          <button type="button" onClick={() => importer.dismiss()} className="rounded-full border border-line-strong px-4 py-2 text-sm hover:border-moss">
            Import another list
          </button>
        )}
      </div>

      {state.unmatched.length > 0 && (
        <section className="mt-6">
          <h3 className="font-hand text-xl text-ink-soft">Help me find these</h3>
          <ul className="mt-2 max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {state.unmatched.map((row) => (
              <li key={`${row.title}|${row.author}`} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {row.title}
                  {row.author && <span className="text-ink-faint"> · {row.author}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => onFind([row.title, row.author].filter(Boolean).join(' '))}
                  className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-moss hover:bg-moss-soft"
                >
                  Search
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** A small pill on the page while an import runs with its dialog closed. */
export function ImportPill({ onOpen }: { onOpen: () => void }) {
  const state = useImportState()
  const handled = state.added + state.existing + state.unmatched.length
  return (
    <AnimatePresence>
      {(state.status === 'running' || state.status === 'paused') && (
        <motion.button
          type="button"
          onClick={onOpen}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed right-4 bottom-4 z-30 flex items-center gap-3 rounded-full border border-line bg-card py-2 pr-4 pl-2 text-sm shadow-[0_18px_40px_-16px_rgb(var(--shadow-rgb)/0.5)]"
        >
          <span className="relative grid size-8 place-items-center">
            <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="var(--moss)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={94.2}
                strokeDashoffset={94.2 * (1 - (state.total ? handled / state.total : 0))}
              />
            </svg>
            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
              <path d="M8 14 V8" stroke="var(--moss)" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M8 9 q -4 -1 -4 -4 q 4 0 4 4 M8 8 q 3 -0.5 4 -4 q -4 0.5 -4 4" fill="var(--moss)" />
            </svg>
          </span>
          {state.status === 'paused' ? 'Import paused' : `Shelving ${handled.toLocaleString()} of ${state.total.toLocaleString()}`}
        </motion.button>
      )}
    </AnimatePresence>
  )
}
