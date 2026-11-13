// The import runs outside React so it keeps going while dialogs open and close.
// Rows go to the API in small batches, two at a time; every added book is put
// straight into the library cache so the shelves fill up as you watch. What's
// left is saved after each batch, so a closed tab can pick up where it stopped.
import type { QueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { IMPORT_BATCH_SIZE } from '../../shared/schemas'
import { localToday } from '../../shared/shelf-rules'
import type { ImportRow } from '../../shared/types'
import { api, type LibraryResponse } from './api'

export interface ImportState {
  status: 'idle' | 'running' | 'paused' | 'done' | 'error'
  total: number
  added: number
  existing: number
  unmatched: { title: string; author: string | null }[]
  latest: string | null
  error: string | null
}

const IDLE: ImportState = { status: 'idle', total: 0, added: 0, existing: 0, unmatched: [], latest: null, error: null }
const CONCURRENCY = 2
const storageKey = (userId: string) => `la-import:${userId}`

let state: ImportState = IDLE
let queue: ImportRow[] = []
let owner: string | null = null
let runId = 0
const listeners = new Set<() => void>()

function set(next: Partial<ImportState>) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

function persist() {
  if (!owner) return
  try {
    if (queue.length === 0) localStorage.removeItem(storageKey(owner))
    else localStorage.setItem(storageKey(owner), JSON.stringify({ queue, state }))
  } catch {
    // Storage full or private mode: the import still runs, it just can't resume.
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function run(client: QueryClient, id: number) {
  const worker = async () => {
    let backoff = 0
    while (id === runId && state.status === 'running' && queue.length > 0) {
      const batch = queue.splice(0, IMPORT_BATCH_SIZE)
      try {
        const { outcomes } = await api.importBatch(batch, localToday())
        if (id !== runId) return
        const retry: ImportRow[] = []
        let added = 0
        let existing = 0
        const unmatched: ImportState['unmatched'] = []
        for (const [i, outcome] of outcomes.entries()) {
          if (outcome.status === 'added') {
            added++
            client.setQueryData<LibraryResponse>(['library'], (data) =>
              data ? { ...data, entries: [...data.entries, outcome.entry] } : data,
            )
          } else if (outcome.status === 'exists') existing++
          else if (outcome.status === 'unmatched') unmatched.push({ title: outcome.title, author: outcome.author })
          else retry.push(batch[i]!)
        }
        const lastAdded = outcomes.findLast((outcome) => outcome.status === 'added')
        set({
          added: state.added + added,
          existing: state.existing + existing,
          unmatched: [...state.unmatched, ...unmatched],
          latest: lastAdded?.title ?? state.latest,
        })
        if (retry.length > 0) {
          // The catalogue asked us to slow down. Put the rows back and wait.
          queue.unshift(...retry)
          backoff = Math.min(30_000, (backoff || 2_000) * 2)
          await sleep(backoff)
        } else backoff = 0
      } catch (error) {
        queue.unshift(...batch)
        backoff = Math.min(30_000, (backoff || 2_000) * 2)
        if (backoff >= 30_000) {
          set({ status: 'error', error: error instanceof Error ? error.message : 'The import stalled' })
          return
        }
        await sleep(backoff)
      }
      persist()
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  if (id === runId && state.status === 'running' && queue.length === 0) {
    set({ status: 'done' })
    persist()
    void client.invalidateQueries({ queryKey: ['library'] })
    void client.invalidateQueries({ queryKey: ['stats'] })
  }
}

export const importer = {
  start(client: QueryClient, userId: string, rows: ImportRow[]) {
    owner = userId
    queue = [...rows]
    runId++
    state = { ...IDLE, status: 'running', total: rows.length }
    listeners.forEach((listener) => listener())
    persist()
    void run(client, runId)
  },
  pause() {
    if (state.status === 'running') set({ status: 'paused' })
    persist()
  },
  resume(client: QueryClient) {
    if (state.status !== 'paused' && state.status !== 'error') return
    runId++
    set({ status: 'running', error: null })
    void run(client, runId)
  },
  cancel() {
    runId++
    queue = []
    persist()
    set({ ...IDLE })
  },
  dismiss() {
    if (state.status === 'done') set({ ...IDLE })
  },
  /** Pick up an import that a closed tab left unfinished, paused until the reader resumes it. */
  restore(userId: string) {
    if (state.status !== 'idle') return
    try {
      const saved = localStorage.getItem(storageKey(userId))
      if (!saved) return
      const parsed = JSON.parse(saved) as { queue: ImportRow[]; state: ImportState }
      if (!parsed.queue?.length) return
      owner = userId
      queue = parsed.queue
      set({ ...parsed.state, status: 'paused' })
    } catch {
      // A corrupt save is not worth a broken page.
    }
  },
  get remaining() {
    return queue.length
  },
}

export function useImportState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
    () => IDLE,
  )
}
