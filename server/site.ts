// Everything the site serves outside /api: the app shell with each page's real
// content already in the HTML, Markdown for agents that ask for it, honest 404s,
// and the machine-readable files (llms.txt, openapi.json, sitemap.xml).
import { docToHtml, docToMarkdown, escapeHtml, type SiteDoc } from '../shared/doc'
import { SHELF_LABELS, SHELVES, type LibraryEntry, type PublicProfile } from '../shared/types'
import { ABOUT_DOC, SITE, SITE_DOCS } from '../shared/site'
import type { Env } from './env'
import { openApiDocument } from './openapi'
import { PAGE_POLICY, RateLimiter, clientKey } from './ratelimit'
import { createStore } from './store'

export interface SiteEnv extends Env {
  ASSETS: Fetcher
}

// ── Content negotiation ───────────────────────────────────────────────────

/** The q-value the Accept header gives a media type (0 when it isn't acceptable). */
function quality(accept: string, type: string): number {
  const [major] = type.split('/')
  let best = -1
  let specificity = -1
  for (const part of accept.split(',')) {
    const [range = '', ...params] = part.trim().toLowerCase().split(';')
    const q = Number(
      params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='))
        ?.slice(2) ?? 1,
    )
    const rank = range === type ? 2 : range === `${major}/*` ? 1 : range === '*/*' ? 0 : -1
    if (rank > specificity) {
      specificity = rank
      best = Number.isFinite(q) ? q : 0
    }
  }
  return Math.max(0, best)
}

/**
 * Markdown when the client names text/markdown and likes it at least as much
 * as HTML. Browsers never name it, so they always get HTML.
 */
export function prefersMarkdown(accept: string | null): boolean {
  if (!accept || !/text\/markdown/i.test(accept)) return false
  const markdown = quality(accept, 'text/markdown')
  return markdown > 0 && markdown >= quality(accept, 'text/html')
}

// ── Routes ────────────────────────────────────────────────────────────────

const DOCS_BY_PATH = new Map(SITE_DOCS.map((doc) => [doc.path, doc]))

type Route =
  | { kind: 'doc'; doc: SiteDoc }
  | { kind: 'shared'; handle: string }
  | { kind: 'private'; title: string }
  | { kind: 'missing' }

const PRIVATE: [RegExp, string][] = [
  [/^\/library$/, 'Your shelves'],
  [/^\/library\/[\w:-]+$/, 'A book on your shelves'],
  [/^\/garden$/, 'Your reading garden'],
  [/^\/discover$/, 'Discover'],
  [/^\/brand$/, 'Brand artboards'],
]

/** Which page a path is, if it is one. `.md` suffixes are already stripped. */
export function routeFor(path: string): Route {
  const doc = DOCS_BY_PATH.get(path === '/index' ? '/' : path)
  if (doc) return { kind: 'doc', doc }
  const shared = /^\/u\/([a-z0-9-]{3,30})$/i.exec(path)
  if (shared) return { kind: 'shared', handle: shared[1]!.toLowerCase() }
  for (const [pattern, title] of PRIVATE) if (pattern.test(path)) return { kind: 'private', title }
  return { kind: 'missing' }
}

// ── Pages as HTML and Markdown ────────────────────────────────────────────

interface Page {
  status: number
  title: string
  description: string
  /** Canonical path. */
  path: string
  /** Body for the HTML shell's #root, before JavaScript takes over. */
  html: string
  markdown: string
  /** Keep out of search results. */
  noindex?: boolean
  cache?: string
}

const link = (path: string) => `${SITE.origin}${path}`

function docPage(doc: SiteDoc): Page {
  return {
    status: 200,
    title: doc.title,
    description: doc.description,
    path: doc.path,
    html: docToHtml(doc),
    markdown: docToMarkdown(doc, SITE.origin),
  }
}

const HELP_LINKS = [
  `[Little Alexandria home](${link('/')})`,
  `[Little Alexandria API docs](${link('/docs')})`,
  `[llms.txt, a guide for agents](${link('/llms.txt')})`,
  `[Sitemap](${link('/sitemap.xml')})`,
]
const helpHtml = `<ul>${HELP_LINKS.map((item) => {
  const [, text, href] = /^\[(.+)\]\((.+)\)$/.exec(item)!
  return `<li><a href="${escapeHtml(href!)}">${escapeHtml(text!)}</a></li>`
}).join('')}</ul>`

function notFoundPage(path: string): Page {
  const message = `There is no page at ${path} on Little Alexandria. It may have moved, or never existed.`
  return {
    status: 404,
    title: `Not found · ${SITE.name}`,
    description: message,
    path,
    noindex: true,
    html: `<h1>This shelf is empty</h1>\n<p>${escapeHtml(message)}</p>\n${helpHtml}`,
    markdown: [
      '# Not found',
      '',
      `There is no page at \`${path}\` on Little Alexandria (HTTP 404). It may have moved, or never existed.`,
      '',
      'Try one of these instead:',
      '',
      ...HELP_LINKS.map((item) => `- ${item}`),
      '',
    ].join('\n'),
  }
}

/** A /u/ address with nobody home, or whose reader keeps their shelves private. */
function closedLibraryPage(path: string): Page {
  const message = `There is no shared library at ${path}. Either nobody lives there, or its reader keeps their shelves private.`
  return {
    ...notFoundPage(path),
    title: `Library closed · ${SITE.name}`,
    description: message,
    html: `<h1>This library is closed</h1>\n<p>${escapeHtml(message)}</p>\n<p><a href="/">Start your own library</a></p>`,
    markdown: [
      '# This library is closed',
      '',
      `${message} (HTTP 404)`,
      '',
      ...HELP_LINKS.map((item) => `- ${item}`),
      '',
    ].join('\n'),
  }
}

function privatePage(path: string, title: string): Page {
  const text =
    'This page belongs to a signed-in reader, so its contents are private and only appear after signing in. Readers who share their shelves have a public library at /u/their-handle instead.'
  return {
    status: 200,
    title: `${title} · ${SITE.name}`,
    description: text,
    path,
    noindex: true,
    html: `<h1>${escapeHtml(title)}</h1>\n<p>${escapeHtml(text)}</p>\n<p><a href="/api/auth/google?next=${encodeURIComponent(path)}">Sign in with Google</a> to open your library.</p>\n${helpHtml}`,
    markdown: [
      `# ${title}`,
      '',
      text,
      '',
      `Sign in: ${link(`/api/auth/google?next=${encodeURIComponent(path)}`)}`,
      '',
      ...HELP_LINKS.map((item) => `- ${item}`),
      '',
    ].join('\n'),
  }
}

const stars = (rating: number | null) =>
  rating ? ` (${'★'.repeat(rating)}${'☆'.repeat(5 - rating)})` : ''
const byline = (entry: LibraryEntry) =>
  `${entry.book.title}${entry.book.authors[0] ? ` by ${entry.book.authors[0]}` : ''}`

/** A shared library, listed shelf by shelf. Notes never appear: the store already strips them. */
function sharedPage(
  handle: string,
  shared: { profile: PublicProfile; entries: LibraryEntry[] },
): Page {
  const first = shared.profile.name.split(' ')[0] ?? shared.profile.name
  const read = shared.entries.filter((entry) => entry.shelf === 'read').length
  const reading = shared.entries.find((entry) => entry.shelf === 'reading')
  const title = `${first}’s library · ${SITE.name}`
  const description = [
    `${shared.entries.length} books on ${first}’s shelves, ${read} read.`,
    reading ? `Currently reading ${reading.book.title}.` : '',
    'Come browse, then start your own.',
  ]
    .filter(Boolean)
    .join(' ')
  const shelves = SHELVES.map((shelf) => ({
    label: SHELF_LABELS[shelf],
    entries: shared.entries.filter((entry) => entry.shelf === shelf),
  })).filter((shelf) => shelf.entries.length > 0)

  const html = [
    `<h1>${escapeHtml(`${first}’s library`)}</h1>`,
    `<p>${escapeHtml(description)}</p>`,
    ...shelves.map(
      (shelf) =>
        `<h2>${escapeHtml(shelf.label)}</h2>\n<ul>${shelf.entries
          .map((entry) => `<li>${escapeHtml(byline(entry) + stars(entry.rating))}</li>`)
          .join('')}</ul>`,
    ),
    `<p><a href="/">Start your own library on Little Alexandria</a></p>`,
  ].join('\n')

  const markdown = [
    `# ${first}’s library`,
    '',
    `> ${description}`,
    '',
    `Shared at ${link(`/u/${handle}`)}. Also available as JSON: ${link(`/api/u/${handle}`)}`,
    ...shelves.flatMap((shelf) => [
      '',
      `## ${shelf.label} (${shelf.entries.length})`,
      '',
      ...shelf.entries.map((entry) => {
        const dates =
          entry.finishedAt && shelf.label === 'Read'
            ? `, finished ${entry.finishedApprox ? entry.finishedAt.slice(0, 4) : entry.finishedAt}`
            : ''
        return `- ${byline(entry)}${stars(entry.rating)}${dates}`
      }),
    ]),
    '',
    `Start your own library: ${link('/')}`,
    '',
  ].join('\n')

  return {
    status: 200,
    title,
    description,
    path: `/u/${handle}`,
    html,
    markdown,
    cache: 'public, max-age=60',
  }
}

// ── The HTML shell ────────────────────────────────────────────────────────

const HEAD_START = '<!-- page:head -->'
const HEAD_END = '<!-- /page:head -->'

const attr = escapeHtml

/** The page-specific <head> tags: title, description, canonical, and social cards. */
export function renderHead(page: Pick<Page, 'title' | 'description' | 'path' | 'noindex'>): string {
  const url = link(page.path)
  const markdownPath = page.path === '/' ? '/index.md' : `${page.path}.md`
  const tags = [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${attr(page.description)}" />`,
    `<link rel="canonical" href="${attr(url)}" />`,
    `<link rel="alternate" type="text/markdown" href="${attr(markdownPath)}" />`,
    `<meta property="og:title" content="${attr(page.title)}" />`,
    `<meta property="og:description" content="${attr(page.description)}" />`,
    `<meta property="og:url" content="${attr(url)}" />`,
  ]
  if (page.noindex) tags.push('<meta name="robots" content="noindex" />')
  if (page.path === '/') {
    tags.push(
      `<meta name="keywords" content="${attr(SITE.keywords.join(', '))}" />`,
      `<script type="application/ld+json">${JSON.stringify(structuredData())}</script>`,
    )
  }
  return tags.join('\n    ')
}

/** Who runs the site and what it is, for search engines and agents. */
function structuredData() {
  const organization = `${SITE.origin}/#organization`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organization,
        name: SITE.name,
        url: `${SITE.origin}/`,
        logo: `${SITE.origin}/icon-512.png`,
        description: ABOUT_DOC.description,
        sameAs: [SITE.github],
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          url: `${SITE.origin}/contact`,
          availableLanguage: 'en',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE.origin}/#website`,
        name: SITE.name,
        url: `${SITE.origin}/`,
        publisher: { '@id': organization },
      },
      {
        '@type': 'WebApplication',
        name: SITE.name,
        url: `${SITE.origin}/`,
        description: SITE.description,
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web',
        keywords: SITE.keywords.join(', '),
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        publisher: { '@id': organization },
      },
    ],
  }
}

/** Put a page into the built index.html: its head tags, and its content inside #root. */
function renderShell(shell: string, page: Page): string {
  const start = shell.indexOf(HEAD_START)
  const end = shell.indexOf(HEAD_END)
  let html =
    start >= 0 && end > start
      ? `${shell.slice(0, start + HEAD_START.length)}\n    ${renderHead(page)}\n    ${shell.slice(end)}`
      : shell
  // A function replacer, so `$&` or `$'` in a book title is just text.
  html = html.replace(
    /<div id="root">[\s\S]*?<\/div>(?=\s*<noscript>)/,
    () => `<div id="root"><article class="prerendered">\n${page.html}\n</article></div>`,
  )
  return html
}

// ── Machine-readable files ────────────────────────────────────────────────

export function llmsTxt(): string {
  return `# Little Alexandria

> ${SITE.description} A free, open-source bookshelf and reading tracker at ${SITE.origin}.

Little Alexandria keeps a reader's books on three shelves (Want to Read, Currently Reading, Read), with ratings, start and finish dates, private notes, a yearly reading goal, and recommendations. Readers can share a read-only copy of their shelves at /u/{handle}; notes and email addresses are never shared.

Every page is available as Markdown: send \`Accept: text/markdown\`, or add \`.md\` to the path (the home page is /index.md). Unknown paths return a real 404.

## When to use Little Alexandria

- [A shared library as Markdown](${link('/u/{handle}.md')}): use when someone shares a little-alexandria.pages.dev/u/ link, or asks what a friend is reading, has read, or rated highly. Replace {handle} with theirs. A 404 means the library is private or does not exist.
- [A shared library as JSON](${link('/api/u/{handle}')}): use for structured data: every book with its shelf, rating, and dates, plus this year's reading stats. No sign-in needed.
- [Little Alexandria API docs](${link('/docs.md')}): use when acting for a signed-in reader to shelve, move, rate, or annotate books. These endpoints need the reader's browser session, so suggest they use the site directly when you have no session.
- [OpenAPI 3.1 spec](${link('/openapi.json')}): every endpoint, with operation ids, parameters, and response schemas, for function calling.

Little Alexandria is not a general book catalogue: for book metadata unrelated to a reader's shelves, use Open Library (https://openlibrary.org/developers/api) directly. Please honour the RateLimit and Retry-After headers.

## Docs

- [About](${link('/about.md')}): what Little Alexandria is and who makes it.
- [Privacy](${link('/privacy.md')}): what is stored, what is shared, and how to export or delete it.
- [Contact](${link('/contact.md')}): bug reports, ideas, and security reports.

## Optional

- [Home page](${link('/index.md')}): the product in its own words.
- [Source code](${SITE.github}): the full source, MIT licensed.
- [Sitemap](${link('/sitemap.xml')})
`
}

export function sitemapXml(handles: string[]): string {
  const urls = [
    ...SITE_DOCS.map((doc) => ({
      loc: link(doc.path),
      priority: doc.path === '/' ? '1.0' : '0.6',
    })),
    ...handles.map((handle) => ({ loc: link(`/u/${handle}`), priority: '0.4' })),
  ]
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      (url) => `  <url><loc>${escapeHtml(url.loc)}</loc><priority>${url.priority}</priority></url>`,
    ),
    '</urlset>',
    '',
  ].join('\n')
}

// ── The handler ───────────────────────────────────────────────────────────

const DISCOVERY_LINKS = [
  '</openapi.json>; rel="service-desc"; type="application/json"',
  '</docs>; rel="service-doc"',
  '</llms.txt>; rel="describedby"; type="text/plain"',
].join(', ')

function respondWith(page: Page, markdown: boolean, shell: string | null): Response {
  const headers = new Headers({
    Vary: 'Accept',
    'Cache-Control': page.cache ?? 'public, max-age=0, must-revalidate',
    Link: DISCOVERY_LINKS,
  })
  if (page.noindex) headers.set('X-Robots-Tag', 'noindex')
  if (markdown || !shell) {
    headers.set('Content-Type', 'text/markdown; charset=utf-8')
    return new Response(page.markdown, { status: page.status, headers })
  }
  headers.set('Content-Type', 'text/html; charset=utf-8')
  return new Response(renderShell(shell, page), { status: page.status, headers })
}

// Pages that read the database (shared libraries, the sitemap) are counted, so
// nobody can hammer D1 through them.
const pageLimiter = new RateLimiter(PAGE_POLICY)
const tooMany = () =>
  new Response('Too many requests. Please slow down.', {
    status: 429,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60' },
  })

const text = (body: string, type: string, cache = 'public, max-age=3600') =>
  new Response(body, {
    headers: { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': cache },
  })

/**
 * Serve one request outside /api. `next` hands it on to Pages: the API
 * function, or a static file.
 */
export async function handleSite(
  request: Request,
  env: SiteEnv,
  next: () => Promise<Response>,
): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  if (path === '/api' || path.startsWith('/api/')) return next()
  if (request.method !== 'GET' && request.method !== 'HEAD') return next()

  switch (path) {
    case '/llms.txt':
      return text(llmsTxt(), 'text/plain')
    case '/openapi.json':
      return new Response(JSON.stringify(openApiDocument(), null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
      })
    case '/sitemap.xml': {
      if (!pageLimiter.hit(clientKey(request.headers)).allowed) return tooMany()
      const handles = await createStore(env.DB)
        .publicHandles()
        .catch(() => [])
      return text(sitemapXml(handles), 'application/xml', 'public, max-age=3600')
    }
  }

  // Trailing slashes have one canonical spelling: without.
  if (path.length > 1 && path.endsWith('/')) {
    // Built from our own origin, never parsed: `//evil.example/` must not become a host.
    const trimmed = path.replace(/^\/+|\/+$/g, '')
    return Response.redirect(`${url.origin}/${trimmed}${url.search}`, 308)
  }

  const asMarkdownFile = path.endsWith('.md')
  const pagePath = asMarkdownFile ? path.slice(0, -3) || '/' : path
  const markdown = asMarkdownFile || prefersMarkdown(request.headers.get('Accept'))
  const route = routeFor(pagePath)

  // Static files (anything with an extension) belong to Pages. A miss there
  // comes back as the app shell, which is a 404 in disguise.
  if (route.kind === 'missing' && !asMarkdownFile && /\.[\w]+$/.test(path)) {
    const response = await next()
    const disguised =
      response.headers.get('Content-Type')?.includes('text/html') && !path.endsWith('.html')
    if (!disguised) return response
  }

  const shell = markdown ? null : await loadShell(env, url)
  let page: Page
  switch (route.kind) {
    case 'doc':
      page = docPage(route.doc)
      break
    case 'private':
      page = privatePage(pagePath, route.title)
      break
    case 'shared': {
      if (!pageLimiter.hit(clientKey(request.headers)).allowed) return tooMany()
      const shared = await createStore(env.DB)
        .publicLibrary(route.handle)
        .catch(() => null)
      page = shared ? sharedPage(route.handle, shared) : closedLibraryPage(pagePath)
      break
    }
    case 'missing':
      page = notFoundPage(path)
      break
  }
  return respondWith(page, markdown, shell)
}

async function loadShell(env: SiteEnv, url: URL): Promise<string> {
  const response = await env.ASSETS.fetch(new URL('/', url).toString())
  return response.text()
}
