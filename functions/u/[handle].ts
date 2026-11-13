// Shared libraries get real link previews. Chat apps and social sites read the
// HTML before any JavaScript runs, so we rewrite the title and Open Graph tags
// on the way out: "Karthik's library · 214 books on Little Alexandria".
import type { Env } from '../../server/env'
import { createStore } from '../../server/store'

interface PagesEnv extends Env {
  ASSETS: Fetcher
}

export const onRequestGet: PagesFunction<PagesEnv, 'handle'> = async ({ request, env, params }) => {
  const page = await env.ASSETS.fetch(new URL('/', request.url))
  const handle = String(params.handle).toLowerCase()
  if (!/^[a-z0-9-]{3,30}$/.test(handle)) return page

  const shared = await createStore(env.DB)
    .publicLibrary(handle)
    .catch(() => null)
  if (!shared) return page

  const first = shared.profile.name.split(' ')[0]
  const read = shared.entries.filter((entry) => entry.shelf === 'read').length
  const reading = shared.entries.find((entry) => entry.shelf === 'reading')
  const title = `${first}’s library · Little Alexandria`
  const description = [
    `${shared.entries.length} books on ${first}’s shelves, ${read} read.`,
    reading ? `Currently reading ${reading.book.title}.` : '',
    'Come browse, then start your own.',
  ]
    .filter(Boolean)
    .join(' ')
  const url = new URL(`/u/${handle}`, request.url).toString()

  const set = (attribute: string, value: string) => ({
    element(element: Element) {
      element.setAttribute(attribute, value)
    },
  })
  return new HTMLRewriter()
    .on('title', {
      element(element) {
        element.setInnerContent(title)
      },
    })
    .on('meta[name="description"]', set('content', description))
    .on('meta[property="og:title"]', set('content', title))
    .on('meta[property="og:description"]', set('content', description))
    .on('meta[property="og:url"]', set('content', url))
    .on('link[rel="canonical"]', set('href', url))
    .transform(
      new Response(page.body, {
        status: page.status,
        headers: { ...Object.fromEntries(page.headers), 'Cache-Control': 'public, max-age=60' },
      }),
    )
}
