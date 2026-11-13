import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { secureHeaders } from 'hono/secure-headers'
import { z } from 'zod'
import {
  addBookSchema,
  goalSchema,
  spineColorSchema,
  updateEntrySchema,
  yearSchema,
} from '../shared/schemas'
import { auth } from './auth'
import type { AppEnv } from './env'
import { LibraryError, bookFromMetadata, bookId, computeStats, isAllowedCoverHost } from './library'
import { readSession } from './session'
import { lookupBook, searchBooks } from './sources'
import { SourceError } from './sources/types'
import { createStore } from './store'

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
  if (!isAllowedCoverHost(url)) {
    return c.json({ error: 'Cover host not allowed' }, 400)
  }
  const upstream = await fetch(url.toString(), {
    cf: { cacheTtl: 60 * 60 * 24 * 30, cacheEverything: true },
  })
  const type = upstream.headers.get('content-type') ?? ''
  // Google answers a missing cover with a 200 grey PNG; real covers are JPEGs.
  const isPlaceholder = url.hostname === 'books.google.com' && type.includes('png')
  if (!upstream.ok || !type.startsWith('image/') || isPlaceholder) {
    return c.body(null, 404, { 'Cache-Control': 'public, max-age=86400' })
  }
  return new Response(upstream.body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
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
