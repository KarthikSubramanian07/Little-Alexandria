import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { app } from './app'
import type { Env } from './env'
import { testDatabase } from './test/d1'

const ORIGIN = 'http://localhost'
// Tests read loosely-shaped JSON; the API's own types are checked in the app.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonResponse = Omit<Response, 'json'> & { json(): Promise<any> }
let database: Awaited<ReturnType<typeof testDatabase>>
let env: Env

beforeAll(async () => {
  database = await testDatabase()
})
afterAll(() => database.dispose())
beforeEach(async () => {
  await database.reset()
  env = { DB: database.db, DEV_LOGIN: '1', BOOK_SOURCE: 'fixture' }
})

/** A tiny client that carries one reader's cookie, like a browser tab would. */
function reader() {
  let cookie = ''
  // Each reader is its own client, as far as rate limits go.
  const address = `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
  return async (path: string, init: RequestInit = {}): Promise<JsonResponse> => {
    const headers = new Headers(init.headers)
    headers.set('CF-Connecting-IP', address)
    if (cookie) headers.set('Cookie', cookie)
    if (init.method && init.method !== 'GET') headers.set('Origin', ORIGIN)
    if (init.body) headers.set('Content-Type', 'application/json')
    const response = await app.request(`${ORIGIN}${path}`, { ...init, headers }, env)
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(';')[0]!
    return response
  }
}

async function signedIn() {
  const call = reader()
  expect((await call('/api/auth/guest', { method: 'POST' })).status).toBe(200)
  return call
}

const add = (call: ReturnType<typeof reader>, sourceId: string, shelf = 'want_to_read') =>
  call('/api/library', {
    method: 'POST',
    body: JSON.stringify({ source: 'fixture', sourceId, shelf, today: '2026-11-13' }),
  })

describe('safeNext', () => {
  it('keeps same-site paths and refuses everything else', async () => {
    const { safeNext } = await import('./auth')
    expect(safeNext('/u/karthik?book=1')).toBe('/u/karthik?book=1')
    for (const evil of ['//evil.com', '/\\evil.com', 'https://evil.com', '/\tevil', undefined]) {
      expect(safeNext(evil)).toBe('/library')
    }
  })
})

describe('auth', () => {
  it('reports no user before signing in', async () => {
    const response = await reader()('/api/auth/me')
    expect(await response.json()).toEqual({ user: null })
  })

  it('signs a guest in and out', async () => {
    const call = await signedIn()
    expect((await (await call('/api/auth/me')).json()).user.name).toBe('Guest Reader')
    expect((await call('/api/auth/logout', { method: 'POST' })).status).toBe(204)
    expect(await (await call('/api/auth/me')).json()).toEqual({ user: null })
  })

  it('stores only a hash of the session token', async () => {
    await signedIn()
    const { results } = await database.db.prepare('SELECT id FROM sessions').all<{ id: string }>()
    expect(results).toHaveLength(1)
    expect(results[0]!.id).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hides guest sign-in unless enabled', async () => {
    env.DEV_LOGIN = undefined
    expect((await reader()('/api/auth/guest', { method: 'POST' })).status).toBe(404)
  })

  it('tells the landing page which providers exist', async () => {
    expect(await (await reader()('/api/auth/providers')).json()).toEqual({
      google: false,
      guest: true,
    })
  })

  it('refuses writes from other origins', async () => {
    const response = await app.request(
      `${ORIGIN}/api/auth/guest`,
      { method: 'POST', headers: { Origin: 'https://evil.example' } },
      env,
    )
    expect(response.status).toBe(403)
  })

  it('redirects to the landing page when Google is not configured', async () => {
    const response = await reader()('/api/auth/google')
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/?error=google_unconfigured')
  })
})

describe('library', () => {
  it('requires a session', async () => {
    expect((await reader()('/api/library')).status).toBe(401)
    expect((await reader()('/api/search?q=dune')).status).toBe(401)
  })

  it('searches, adds, moves, rates, and removes a book', async () => {
    const call = await signedIn()
    const search = await (await call('/api/search?q=le%20guin')).json()
    expect(search.results.map((r: { title: string }) => r.title)).toEqual([
      'A Wizard of Earthsea',
      'The Left Hand of Darkness',
    ])

    const created = await add(call, 'OL59798W')
    expect(created.status).toBe(201)
    const { entry } = await created.json()
    expect(entry.book.title).toBe('A Wizard of Earthsea')
    expect(entry.book.coverUrl).toMatch(/^\/api\/cover\?src=/)

    const moved = await call(`/api/library/${entry.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ shelf: 'read', finishedAt: '2026-11-13', rating: 5 }),
    })
    expect((await moved.json()).entry).toMatchObject({
      shelf: 'read',
      rating: 5,
      finishedAt: '2026-11-13',
    })

    const stats = await (await call('/api/stats?year=2026')).json()
    expect(stats).toMatchObject({ booksRead: 1, pagesRead: 205 })

    expect((await call(`/api/library/${entry.id}`, { method: 'DELETE' })).status).toBe(204)
    expect((await (await call('/api/library')).json()).entries).toEqual([])
  })

  it('keeps each reader’s shelves private', async () => {
    const alice = await signedIn()
    const { entry } = await (await add(alice, 'OL893414W')).json()

    // A second, real reader with their own session.
    const { createStore } = await import('./store')
    const { sessionIdFor } = await import('./session')
    const store = createStore(database.db)
    const bob = await store.upsertUser('google:bob', { name: 'Bob', email: null, avatarUrl: null })
    await store.putSession(sessionIdFor('b'.repeat(32)), bob.id, Date.now() + 60_000)
    const asBob = async (path: string, init: RequestInit = {}): Promise<JsonResponse> =>
      app.request(
        `${ORIGIN}${path}`,
        {
          ...init,
          headers: {
            Cookie: `la_session=${'b'.repeat(32)}`,
            Origin: ORIGIN,
            'Content-Type': 'application/json',
          },
        },
        env,
      )

    expect((await (await asBob('/api/library')).json()).entries).toEqual([])
    const tamper = await asBob(`/api/library/${entry.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ rating: 1 }),
    })
    expect(tamper.status).toBe(404)
    expect((await asBob(`/api/library/${entry.id}`, { method: 'DELETE' })).status).toBe(404)
    expect(
      (
        await asBob(`/api/library/${entry.id}/spine`, {
          method: 'PUT',
          body: JSON.stringify({ color: '#000000' }),
        })
      ).status,
    ).toBe(404)
    const alicesBook = (await (await alice('/api/library')).json()).entries[0]
    expect(alicesBook.rating).toBeNull()
    expect(alicesBook.book.spineColor).toBeNull()

    // Bob can shelve the same book; the catalogue row is shared, not duplicated.
    expect(
      (
        await asBob('/api/library', {
          method: 'POST',
          body: JSON.stringify({
            source: 'fixture',
            sourceId: 'OL893414W',
            shelf: 'read',
            today: '2026-11-13',
          }),
        })
      ).status,
    ).toBe(201)
    const { results } = await database.db
      .prepare('SELECT COUNT(*) AS n FROM books')
      .all<{ n: number }>()
    expect(results[0]!.n).toBe(1)
  })

  it('orders shelves with fractional positions', async () => {
    const call = await signedIn()
    const a = (await (await add(call, 'OL893414W')).json()).entry
    const b = (await (await add(call, 'OL27482W')).json()).entry
    // Newest first: b, a. Drag a between nothing and b, i.e. to the front.
    const { generateKeyBetween } = await import('fractional-indexing')
    const front = generateKeyBetween(null, b.position)
    await call(`/api/library/${a.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ position: front }),
    })
    const entries = (await (await call('/api/library')).json()).entries
    expect(entries.map((entry: { id: string }) => entry.id)).toEqual([a.id, b.id])
    // Two books can't share a spot.
    const clash = await call(`/api/library/${b.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ position: front }),
    })
    expect(clash.status).toBe(409)
  })

  it('refuses duplicates with 409', async () => {
    const call = await signedIn()
    await add(call, 'OL893414W')
    expect((await add(call, 'OL893414W', 'read')).status).toBe(409)
  })

  it('validates input', async () => {
    const call = await signedIn()
    const { entry } = await (await add(call, 'OL893414W')).json()
    const bad = async (patch: unknown) =>
      (await call(`/api/library/${entry.id}`, { method: 'PATCH', body: JSON.stringify(patch) }))
        .status
    expect(await bad({ rating: 6 })).toBe(400)
    expect(await bad({ rating: 2.5 })).toBe(400)
    expect(await bad({ startedAt: '2026-02-30' })).toBe(400)
    expect(await bad({ shelf: 'attic' })).toBe(400)
    expect(await bad({})).toBe(400)
    expect(await bad({ startedAt: '2026-05-02', finishedAt: '2026-05-01' })).toBe(400)
    expect((await add(call, 'OL0000000W')).status).toBe(404)
    const notJson = await call('/api/library', { method: 'POST', body: 'nope' })
    expect(notJson.status).toBe(400)
  })

  it('sets a yearly goal and a spine colour', async () => {
    const call = await signedIn()
    const { entry } = await (await add(call, 'OL893414W')).json()
    expect(
      (await call('/api/goals/2026', { method: 'PUT', body: JSON.stringify({ target: 30 }) }))
        .status,
    ).toBe(200)
    expect(
      (
        await call(`/api/library/${entry.id}/spine`, {
          method: 'PUT',
          body: JSON.stringify({ color: '#a0522d' }),
        })
      ).status,
    ).toBe(204)
    // The first sampled colour sticks; later samples don't repaint the catalogue.
    await call(`/api/library/${entry.id}/spine`, {
      method: 'PUT',
      body: JSON.stringify({ color: '#000000' }),
    })
    expect(
      (
        await call(`/api/library/${entry.id}/spine`, {
          method: 'PUT',
          body: JSON.stringify({ color: 'red' }),
        })
      ).status,
    ).toBe(400)
    const library = await (await call('/api/library')).json()
    expect(library.goals).toEqual({ '2026': 30 })
    expect(library.entries[0].book.spineColor).toBe('#a0522d')
  })
})

describe('sharing', () => {
  const me = async (call: ReturnType<typeof reader>) =>
    (await (await call('/api/auth/me')).json()).user

  it('gives every reader a handle, private by default', async () => {
    const call = await signedIn()
    const user = await me(call)
    expect(user.handle).toBe('guest-reader')
    expect(user.isPublic).toBe(false)
    expect((await reader()(`/api/u/${user.handle}`)).status).toBe(404)
  })

  it('shares shelves without notes once the reader opts in', async () => {
    const call = await signedIn()
    const { entry } = await (await add(call, 'OL893414W', 'read')).json()
    await call(`/api/library/${entry.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ notes: 'private thoughts', rating: 5 }),
    })
    const update = await call('/api/me', {
      method: 'PATCH',
      body: JSON.stringify({ isPublic: true, handle: 'Dune-Fan' }),
    })
    expect((await update.json()).user).toMatchObject({ handle: 'dune-fan', isPublic: true })

    const shared = await (await reader()('/api/u/dune-fan')).json()
    expect(shared.profile).toEqual({ name: 'Guest Reader', handle: 'dune-fan', avatarUrl: null })
    expect(shared.entries[0]).toMatchObject({ rating: 5, notes: null })
    expect(shared.stats.booksRead).toBe(1)
    expect(JSON.stringify(shared)).not.toContain('private thoughts')
    expect(JSON.stringify(shared)).not.toContain('email')
  })

  it('refuses reserved, malformed, and taken handles', async () => {
    const call = await signedIn()
    const set = async (handle: string) =>
      (await call('/api/me', { method: 'PATCH', body: JSON.stringify({ handle }) })).status
    expect(await set('library')).toBe(409)
    expect(await set('a')).toBe(400)
    expect(await set('-bad-')).toBe(400)
    const { createStore } = await import('./store')
    const other = await createStore(database.db).upsertUser('google:x', {
      name: 'Taken',
      email: null,
      avatarUrl: null,
    })
    expect(await set(other.handle)).toBe(409)
  })
})

describe('import', () => {
  const row = (title: string, extra: Record<string, unknown> = {}) => ({
    title,
    author: null,
    isbn: null,
    shelf: 'want_to_read',
    rating: null,
    finishedAt: null,
    finishedYear: null,
    notes: null,
    genreHint: null,
    ...extra,
  })

  it('shelves matches, skips duplicates, and reports what it could not find', async () => {
    const call = await signedIn()
    await add(call, 'OL893414W')
    const response = await call('/api/import', {
      method: 'POST',
      body: JSON.stringify({
        today: '2026-11-13',
        rows: [
          row('Piranesi', { shelf: 'read', finishedYear: 2025, rating: 4 }),
          row('Dune'),
          row('A Book That Does Not Exist'),
          row('Circe', { shelf: 'read', finishedAt: '2024-05-01', notes: 'Wonderful' }),
        ],
      }),
    })
    expect(response.status).toBe(200)
    const { outcomes } = await response.json()
    expect(outcomes.map((outcome: { status: string }) => outcome.status)).toEqual([
      'added',
      'exists',
      'unmatched',
      'added',
    ])
    expect(outcomes[0].entry).toMatchObject({
      shelf: 'read',
      finishedAt: '2025-12-31',
      finishedApprox: true,
      rating: 4,
    })
    expect(outcomes[3].entry).toMatchObject({
      finishedAt: '2024-05-01',
      finishedApprox: false,
      notes: 'Wonderful',
    })
  })

  it('caps batch size', async () => {
    const call = await signedIn()
    const rows = Array.from({ length: 7 }, (_, i) => row(`Book ${i}`))
    expect(
      (
        await call('/api/import', {
          method: 'POST',
          body: JSON.stringify({ today: '2026-11-13', rows }),
        })
      ).status,
    ).toBe(400)
  })
})

describe('your data', () => {
  it('exports the library as a Goodreads-style CSV that imports back', async () => {
    const call = await signedIn()
    const { entry } = await (await add(call, 'OL893414W', 'read')).json()
    await call(`/api/library/${entry.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ rating: 5, notes: 'Spice, "melange", and sand' }),
    })
    const response = await call('/api/export')
    expect(response.headers.get('content-type')).toContain('text/csv')
    expect(response.headers.get('content-disposition')).toMatch(
      /attachment; filename="little-alexandria-/,
    )
    const csv = await response.text()
    const { parseReadingList } = await import('../shared/import')
    const { format, rows } = parseReadingList(csv)
    expect(format).toBe('goodreads')
    expect(rows[0]).toMatchObject({
      title: 'Dune',
      shelf: 'read',
      rating: 5,
      notes: 'Spice, "melange", and sand',
      finishedAt: '2026-11-13',
    })
  })

  it('deletes the account and everything on its shelves', async () => {
    const call = await signedIn()
    await add(call, 'OL893414W')
    expect((await call('/api/me', { method: 'DELETE' })).status).toBe(204)
    expect(await (await call('/api/auth/me')).json()).toEqual({ user: null })
    for (const table of ['users', 'sessions', 'user_books']) {
      const { results } = await database.db
        .prepare(`SELECT COUNT(*) AS n FROM ${table}`)
        .all<{ n: number }>()
      expect(results[0]!.n).toBe(0)
    }
  })
})

describe('cover proxy', () => {
  it('refuses hosts outside the allowlist, and odd shapes on allowed hosts', async () => {
    for (const src of [
      'https://evil.example/x.jpg',
      'https://covers.openlibrary.org:8443/b/id/1-L.jpg',
      'https://covers.openlibrary.org/b/id/1-L.jpg?default=false&bust=1',
      'https://covers.openlibrary.org/../admin',
      'http://covers.openlibrary.org/b/id/1-L.jpg',
    ]) {
      const response = await reader()(`/api/cover?src=${encodeURIComponent(src)}`)
      expect(response.status, src).toBe(400)
    }
  })
})
