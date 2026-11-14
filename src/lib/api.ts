import type {
  ImportOutcome,
  ImportRow,
  LibraryEntry,
  PublicProfile,
  ReadingStats,
  SearchResult,
  Shelf,
  User,
} from '../../shared/types'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  let response: Response
  try {
    response = await fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' })
  } catch {
    throw new ApiError('You seem to be offline. Your shelves will wait.', 0)
  }
  if (response.status === 204) return undefined as T
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) throw new ApiError(body?.error ?? 'Something went wrong', response.status)
  return body as T
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
})

export interface LibraryResponse {
  entries: LibraryEntry[]
  goals: Record<string, number>
}

export type EntryPatch = Partial<
  Pick<LibraryEntry, 'shelf' | 'position' | 'rating' | 'notes' | 'startedAt' | 'finishedAt'>
>

export interface Adaptation {
  title: string
  year: number | null
  kind: 'film' | 'series' | 'other'
  url: string
}

export interface RelatedResponse {
  description: string | null
  byAuthor: SearchResult[]
  similar: SearchResult[]
  adaptations: Adaptation[]
}

interface SharedLibrary {
  profile: PublicProfile
  entries: LibraryEntry[]
  stats: ReadingStats
}

interface DiscoverSection {
  kind: 'author' | 'genre'
  title: string
  books: SearchResult[]
}

export const api = {
  me: () => request<{ user: User | null }>('/auth/me'),
  providers: () => request<{ google: boolean; guest: boolean }>('/auth/providers'),
  guest: () => request<{ user: User }>('/auth/guest', json('POST')),
  logout: () => request<void>('/auth/logout', json('POST')),

  search: (query: string, signal?: AbortSignal) =>
    request<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(query)}`, { signal }),
  library: () => request<LibraryResponse>('/library'),
  add: (input: { source: SearchResult['source']; sourceId: string; shelf: Shelf; today: string }) =>
    request<{ entry: LibraryEntry }>('/library', json('POST', input)),
  update: (id: string, patch: EntryPatch) =>
    request<{ entry: LibraryEntry }>(`/library/${id}`, json('PATCH', patch)),
  remove: (id: string) => request<void>(`/library/${id}`, json('DELETE')),
  spine: (id: string, color: string) => request<void>(`/library/${id}/spine`, json('PUT', { color })),
  setGoal: (year: number, target: number) =>
    request<{ year: number; target: number }>(`/goals/${year}`, json('PUT', { target })),
  stats: (year: number) => request<ReadingStats>(`/stats?year=${year}`),
  updateProfile: (changes: { handle?: string; isPublic?: boolean }) =>
    request<{ user: User }>('/me', json('PATCH', changes)),
  shared: (handle: string) => request<SharedLibrary>(`/u/${encodeURIComponent(handle)}`),
  importBatch: (rows: ImportRow[], today: string) =>
    request<{ outcomes: ImportOutcome[] }>('/import', json('POST', { rows, today })),
  related: (entryId: string) => request<RelatedResponse>(`/library/${entryId}/related`),
  discover: () => request<{ sections: DiscoverSection[] }>('/discover'),
  deleteAccount: () => request<void>('/me', json('DELETE')),
}
