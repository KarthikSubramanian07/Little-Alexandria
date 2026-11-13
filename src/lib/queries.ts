import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { comparePositions, frontOf } from '../../shared/positions'
import { datesForShelf, localToday } from '../../shared/shelf-rules'
import type { LibraryEntry, SearchResult, Shelf } from '../../shared/types'
import { api, type EntryPatch, type LibraryResponse } from './api'
import { toast } from './toast'

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async () => (await api.me()).user,
  staleTime: 5 * 60_000,
})

export const libraryQuery = queryOptions({
  queryKey: ['library'],
  queryFn: api.library,
  staleTime: 30_000,
})

export const statsQuery = (year: number) =>
  queryOptions({ queryKey: ['stats', year], queryFn: () => api.stats(year) })

export const useMe = () => useQuery(meQuery)
export const useLibrary = () => useQuery(libraryQuery)

/** Entries of one shelf, in reading order. */
export function shelfOf(entries: LibraryEntry[], shelf: Shelf) {
  return entries
    .filter((entry) => entry.shelf === shelf)
    .sort((a, b) => comparePositions(a.position, b.position))
}

/**
 * Every library write shares one mutation scope, so they run one at a time in
 * the order the reader made them. A quick drag after a quick drag can never
 * land out of order.
 */
const LIBRARY_SCOPE = { id: 'library' }

function setEntries(client: QueryClient, update: (entries: LibraryEntry[]) => LibraryEntry[]) {
  client.setQueryData<LibraryResponse>(libraryQuery.queryKey, (data) =>
    data ? { ...data, entries: update(data.entries) } : data,
  )
}

function useOptimistic() {
  const client = useQueryClient()
  return {
    client,
    async snapshot() {
      await client.cancelQueries({ queryKey: libraryQuery.queryKey })
      return client.getQueryData<LibraryResponse>(libraryQuery.queryKey)
    },
    restore(previous: LibraryResponse | undefined) {
      if (previous) client.setQueryData(libraryQuery.queryKey, previous)
    },
    settle() {
      void client.invalidateQueries({ queryKey: ['stats'] })
    },
  }
}

export function useAddBook() {
  const { client, settle } = useOptimistic()
  return useMutation({
    scope: LIBRARY_SCOPE,
    mutationFn: ({ result, shelf }: { result: SearchResult; shelf: Shelf }) =>
      api.add({ source: result.source, sourceId: result.sourceId, shelf, today: localToday() }),
    onSuccess: ({ entry }) => {
      setEntries(client, (entries) => [...entries.filter((e) => e.id !== entry.id), entry])
      settle()
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useUpdateEntry() {
  const { client, snapshot, restore, settle } = useOptimistic()
  return useMutation({
    scope: LIBRARY_SCOPE,
    mutationFn: ({ id, patch }: { id: string; patch: EntryPatch; quiet?: boolean }) =>
      api.update(id, patch),
    onMutate: async ({ id, patch }) => {
      const previous = await snapshot()
      setEntries(client, (entries) =>
        entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      )
      return { previous }
    },
    onError: (error, _input, context) => {
      restore(context?.previous)
      toast.error(error.message)
    },
    onSuccess: ({ entry }) => {
      setEntries(client, (entries) => entries.map((e) => (e.id === entry.id ? entry : e)))
      settle()
    },
  })
}

/**
 * Move a book to another shelf and/or spot, stamping its dates. Without a
 * position it goes to the front of the shelf, exactly as the server would.
 */
export function useMoveEntry() {
  const client = useQueryClient()
  const update = useUpdateEntry()
  return (entry: LibraryEntry, shelf: Shelf, position?: string) => {
    if (shelf === entry.shelf && !position) return
    const entries = client.getQueryData<LibraryResponse>(libraryQuery.queryKey)?.entries ?? []
    const first = shelfOf(entries, shelf).find((other) => other.id !== entry.id)
    const patch: EntryPatch = {
      ...datesForShelf(entry, shelf, localToday()),
      shelf,
      position: position ?? frontOf(first?.position ?? null),
    }
    update.mutate({ id: entry.id, patch })
  }
}

export function useRemoveEntry() {
  const { client, snapshot, restore, settle } = useOptimistic()
  const add = useAddBook()
  return useMutation({
    scope: LIBRARY_SCOPE,
    mutationFn: (entry: LibraryEntry) => api.remove(entry.id),
    onMutate: async (entry) => {
      const previous = await snapshot()
      setEntries(client, (entries) => entries.filter((e) => e.id !== entry.id))
      return { previous }
    },
    onError: (error, _entry, context) => {
      restore(context?.previous)
      toast.error(error.message)
    },
    onSuccess: (_data, entry) => {
      settle()
      toast.message(`“${entry.book.title}” left the shelves`, {
        action: {
          label: 'Undo',
          onClick: () =>
            add.mutate({
              result: {
                source: entry.book.source,
                sourceId: entry.book.sourceId,
                title: entry.book.title,
                authors: entry.book.authors,
                publishedYear: entry.book.publishedYear,
                pageCount: entry.book.pageCount,
                thumbnailUrl: entry.book.coverUrl,
              },
              shelf: entry.shelf,
            }),
        },
      })
    },
  })
}

export function useSetGoal() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ year, target }: { year: number; target: number }) => api.setGoal(year, target),
    onSuccess: ({ year, target }) => {
      client.setQueryData<LibraryResponse>(libraryQuery.queryKey, (data) =>
        data ? { ...data, goals: { ...data.goals, [String(year)]: target } } : data,
      )
      void client.invalidateQueries({ queryKey: ['stats', year] })
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useSignOut() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      client.setQueryData(meQuery.queryKey, null)
      client.removeQueries({ queryKey: libraryQuery.queryKey })
    },
  })
}
