import { Hono } from 'hono'
import { deleteCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import { z } from 'zod'
import {
  addBookSchema,
  goalSchema,
  importBatchSchema,
  profileSchema,
  spineColorSchema,
  updateEntrySchema,
  yearSchema,
} from '../shared/schemas'
import { libraryToCsv } from '../shared/export'
import type { ImportOutcome } from '../shared/types'
import { aboutFor, fixtureAbout } from './about'
import { auth } from './auth'
import type { AppEnv } from './env'
import {
  COVER_POLICY,
  DEFAULT_POLICY,
  IMPORT_POLICY,
  RateLimiter,
  clientKey,
  rateLimit,
} from './ratelimit'
import {
  COVER_TYPES,
  LibraryError,
  bookFromMetadata,
  bookId,
  computeStats,
  isAllowedCoverRedirect,
  isCanonicalCover,
} from './library'
import { SESSION_COOKIE, readSession } from './session'
import { discoverFor, relatedFor } from './related'
import { lookupBook, searchBooks } from './sources'
import { matchOpenLibrary } from './sources/openlibrary'
import { KNOWN_GENRES } from './sources/genres'
import { SourceError } from './sources/types'
import { RESERVED_HANDLES, createStore } from './store'

/** Parse a JSON body against a schema, or answer 400 with the first problem. */
async function body<T extends z.ZodType>(c: { req: { json(): Promise<unknown> } }, schema: T) {
  const raw = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Expected a JSON body' })
  })
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? 'Invalid request' })
  }
  return parsed.data as z.infer<T>
}

const api = new Hono<AppEnv>()

// Covers have their own, roomier budget (a full library is hundreds of them) and
// carry no rate-limit headers, since browsers cache them for a year. Imports reach
// out to the catalogues for every row, so they get a tighter one.
const limiter = new RateLimiter(DEFAULT_POLICY)
const coverLimiter = new RateLimiter(COVER_POLICY)
const importLimiter = new RateLimiter(IMPORT_POLICY)
api.use('*', async (c, next) => {
  if (c.req.path === '/api/cover') {
    if (!coverLimiter.hit(clientKey(c.req.raw.headers)).allowed) {
      return c.body(null, 429, { 'Retry-After': '60' })
    }
    return next()
  }
  if (c.req.path === '/api/import') return rateLimit(importLimiter)(c, next)
  return rateLimit(limiter)(c, next)
})

// Cookies are SameSite=Lax; on top of that, writes must come from our own origin.
api.use('*', async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const origin = c.req.header('Origin')
    if (!origin || origin !== new URL(c.req.url).origin) {
      return c.json({ error: 'Cross-origin request refused' }, 403)
    }
  }
  await next()
})

api.route('/auth', auth)

/** Covers proxied through our origin, so the browser can sample their colours. */
api.get('/cover', async (c) => {
  const src = c.req.query('src')
  let url: URL
  try {
    url = new URL(src ?? '')
  } catch {
    return c.json({ error: 'Bad cover URL' }, 400)
  }
  if (!isCanonicalCover(url)) {
    return c.json({ error: 'Cover host not allowed' }, 400)
  }
  // Offline mode stays offline: books fall back to their typeset cloth covers.
  if (c.env.BOOK_SOURCE === 'fixture') return c.body(null, 404)
  const missing = () => c.body(null, 404, { 'Cache-Control': 'public, max-age=86400' })

  // Follow redirects by hand, so every hop has to be a host we trust.
  let upstream: Response | null = null
  let target = url
  for (let hop = 0; hop < 4; hop++) {
    const response = await fetch(target.toString(), {
      redirect: 'manual',
      cf: { cacheTtl: 60 * 60 * 24 * 30, cacheEverything: true },
    })
    const location = response.headers.get('location')
    if (response.status < 300 || response.status >= 400 || !location) {
      upstream = response
      break
    }
    const next = new URL(location, target)
    if (!isAllowedCoverRedirect(next)) return missing()
    target = next
  }
  if (!upstream) return missing()

  const type = (upstream.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
  // Google answers a missing cover with a 200 grey PNG; real covers are JPEGs.
  const isPlaceholder = url.hostname === 'books.google.com' && type === 'image/png'
  if (!upstream.ok || !COVER_TYPES.includes(type) || isPlaceholder) return missing()
  return new Response(upstream.body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  })
})

/**
 * What the open catalogues know about a book: reading time, readers' verdict,
 * the opening lines, the story's places and people, and the author. Public,
 * because it is catalogue data, but only for books someone has shelved, so
 * this can't be used to fetch arbitrary pages through us.
 */
api.get('/books/:id/about', async (c) => {
  const store = createStore(c.env.DB)
  const book = await store.getBook(c.req.param('id'))
  if (!book) return c.json({ error: 'That book isn’t in the catalogue' }, 404)
  const about = c.env.BOOK_SOURCE === 'fixture' ? fixtureAbout(book) : await aboutFor(book)
  // Books imported from a list arrive without a description; keep the one we found.
  if (!book.description && about.description) {
    await store.setDescription(book.id, about.description)
  }
  return c.json(about, 200, { 'Cache-Control': 'public, max-age=86400' })
})

/** A shared library, read-only and without notes. 404 unless its owner shared it. */
api.get('/u/:handle', async (c) => {
  const store = createStore(c.env.DB)
  const shared = await store.publicLibrary(c.req.param('handle').toLowerCase())
  if (!shared) return c.json({ error: 'No shared library at that address' }, 404)
  const year = new Date().getUTCFullYear()
  const goals = await store.getGoals(shared.userId)
  return c.json(
    {
      profile: shared.profile,
      entries: shared.entries,
      stats: computeStats(shared.entries, goals, year),
    },
    200,
    { 'Cache-Control': 'public, max-age=60' },
  )
})

// Everything below needs a signed-in reader.
const reader = new Hono<AppEnv>()
reader.use('*', async (c, next) => {
  const userId = await readSession(c, createStore(c.env.DB))
  if (!userId) return c.json({ error: 'Sign in to continue' }, 401)
  c.set('userId', userId)
  await next()
})

const storeOf = (c: { env: AppEnv['Bindings'] }) => createStore(c.env.DB)

reader.get('/search', async (c) => {
  const query = (c.req.query('q') ?? '').trim().slice(0, 120)
  if (query.length < 2) return c.json({ results: [] })
  const results = await searchBooks(c.env, query, c.req.raw.signal)
  return c.json({ results }, 200, { 'Cache-Control': 'private, max-age=300' })
})

reader.get('/library', async (c) => {
  const store = storeOf(c)
  const [entries, goals] = await Promise.all([
    store.listEntries(c.get('userId')),
    store.getGoals(c.get('userId')),
  ])
  return c.json({ entries, goals })
})

reader.post('/library', async (c) => {
  const input = await body(c, addBookSchema)
  const store = storeOf(c)
  if (await store.hasBook(c.get('userId'), bookId(input.source, input.sourceId))) {
    return c.json({ error: 'Already on your shelves' }, 409)
  }
  const metadata = await lookupBook(c.env, input.source, input.sourceId)
  if (!metadata) return c.json({ error: 'We couldn’t find that book' }, 404)
  const entry = await store.addEntry(
    c.get('userId'),
    bookFromMetadata(metadata),
    input.shelf,
    input.today,
  )
  return c.json({ entry }, 201)
})

reader.patch('/library/:id', async (c) => {
  const patch = await body(c, updateEntrySchema)
  const entry = await storeOf(c).updateEntry(c.get('userId'), c.req.param('id'), patch)
  return c.json({ entry })
})

reader.delete('/library/:id', async (c) => {
  await storeOf(c).removeEntry(c.get('userId'), c.req.param('id'))
  return c.body(null, 204)
})

reader.put('/library/:id/spine', async (c) => {
  const { color } = await body(c, spineColorSchema)
  await storeOf(c).setSpineColor(c.get('userId'), c.req.param('id'), color)
  return c.body(null, 204)
})

reader.put('/goals/:year', async (c) => {
  const year = yearSchema.parse(c.req.param('year'))
  const { target } = await body(c, goalSchema)
  await storeOf(c).setGoal(c.get('userId'), year, target)
  return c.json({ year, target })
})

/** Everything on your shelves, as a CSV Goodreads (or anything else) can read. */
reader.get('/export', async (c) => {
  const entries = await storeOf(c).listEntries(c.get('userId'))
  const date = new Date().toISOString().slice(0, 10)
  return c.body(libraryToCsv(entries), 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="little-alexandria-${date}.csv"`,
    'Cache-Control': 'no-store',
  })
})

/** Close the account for good: the reader, their sessions, shelves, notes, and goals. */
reader.delete('/me', async (c) => {
  await storeOf(c).deleteUser(c.get('userId'))
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.body(null, 204)
})

reader.patch('/me', async (c) => {
  const changes = await body(c, profileSchema)
  if (changes.handle && RESERVED_HANDLES.has(changes.handle)) {
    return c.json({ error: 'That address is reserved' }, 409)
  }
  const user = await storeOf(c).updateProfile(c.get('userId'), changes)
  return c.json({ user })
})

/**
 * Import a small batch of reading-list rows. The browser sends batches one
 * after another, so a thousand-book list never hits a request limit, and
 * books start appearing on the shelves while the rest are still on their way.
 */
reader.post('/import', async (c) => {
  const { rows, today } = await body(c, importBatchSchema)
  const store = storeOf(c)
  const userId = c.get('userId')
  const outcomes: ImportOutcome[] = []
  let throttled = false
  for (const row of rows) {
    if (throttled) {
      outcomes.push({ status: 'retry', title: row.title })
      continue
    }
    try {
      const metadata =
        c.env.BOOK_SOURCE === 'fixture'
          ? await lookupFixture(c.env, row.title)
          : await matchOpenLibrary(row)
      if (!metadata) {
        outcomes.push({ status: 'unmatched', title: row.title, author: row.author })
        continue
      }
      const book = bookFromMetadata(metadata)
      if (await store.hasBook(userId, book.id)) {
        outcomes.push({ status: 'exists', title: book.title })
        continue
      }
      const finishedAt = row.finishedAt ?? (row.finishedYear ? `${row.finishedYear}-12-31` : null)
      const entry = await store.addEntry(userId, book, row.shelf, today, {
        rating: row.rating,
        notes: row.notes,
        finishedAt,
        finishedApprox: !row.finishedAt && row.finishedYear !== null,
        // Hints land in the shared books table, so only our own genre names get in.
        genreHint: row.genreHint && KNOWN_GENRES.has(row.genreHint) ? row.genreHint : null,
      })
      outcomes.push({ status: 'added', title: book.title, entry })
    } catch (error) {
      if (error instanceof LibraryError && error.status === 409) {
        outcomes.push({ status: 'exists', title: row.title })
      } else if (error instanceof SourceError) {
        // The catalogue asked us to slow down: hand the rest back for a retry.
        throttled = true
        outcomes.push({ status: 'retry', title: row.title })
      } else throw error
    }
  }
  return c.json({ outcomes })
})

/** More like this: the author's other books, similar books, and adaptations. */
reader.get('/library/:id/related', async (c) => {
  // The offline catalogue (tests, local dev) never reaches out to live services.
  if (c.env.BOOK_SOURCE === 'fixture') {
    return c.json({ description: null, byAuthor: [], similar: [], adaptations: [] })
  }
  const store = storeOf(c)
  const userId = c.get('userId')
  const [entry, entries] = await Promise.all([
    store.getEntry(userId, c.req.param('id')),
    store.listEntries(userId),
  ])
  const related = await relatedFor(entry, entries)
  // Books imported from a list arrive without a description; fill it in once.
  if (!entry.book.description && related.description) {
    await store.setDescription(entry.book.id, related.description)
  }
  return c.json(related, 200, { 'Cache-Control': 'private, max-age=600' })
})

reader.get('/discover', async (c) => {
  if (c.env.BOOK_SOURCE === 'fixture') return c.json({ sections: [] })
  const entries = await storeOf(c).listEntries(c.get('userId'))
  return c.json({ sections: await discoverFor(entries) }, 200, {
    'Cache-Control': 'private, max-age=900',
  })
})

reader.get('/stats', async (c) => {
  const parsed = yearSchema.safeParse(c.req.query('year') ?? new Date().getUTCFullYear())
  if (!parsed.success) return c.json({ error: 'Bad year' }, 400)
  const store = storeOf(c)
  const [entries, goals] = await Promise.all([
    store.listEntries(c.get('userId')),
    store.getGoals(c.get('userId')),
  ])
  return c.json(computeStats(entries, goals, parsed.data))
})

api.route('/', reader)

/** Offline catalogue lookups for tests and local development. */
async function lookupFixture(env: AppEnv['Bindings'], title: string) {
  const results = await searchBooks(env, title)
  const first = results[0]
  return first ? lookupBook(env, first.source, first.sourceId) : null
}

export const app = new Hono<AppEnv>().basePath('/api')
app.use('*', secureHeaders())
app.route('/', api)
app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((error, c) => {
  if (error instanceof HTTPException) return c.json({ error: error.message }, error.status)
  if (error instanceof LibraryError) return c.json({ error: error.message }, error.status)
  if (error instanceof z.ZodError) return c.json({ error: 'Invalid request' }, 400)
  if (error instanceof SourceError) {
    return c.json({ error: 'The book catalogue is busy. Try again in a moment.' }, 503)
  }
  console.error(error)
  return c.json({ error: 'Something went wrong on our side' }, 500)
})
