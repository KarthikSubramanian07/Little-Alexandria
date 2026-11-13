import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { HOME_DOC } from '../shared/site'
import { createStore } from './store'
import {
  handleSite,
  llmsTxt,
  prefersMarkdown,
  renderHead,
  routeFor,
  sitemapXml,
  type SiteEnv,
} from './site'
import { testDatabase } from './test/d1'

const SHELL = readFileSync('index.html', 'utf8')

describe('prefersMarkdown', () => {
  it.each([
    ['text/markdown', true],
    ['text/markdown, text/html;q=0.9', true],
    ['text/markdown, text/html, */*', true],
    ['text/html, text/markdown;q=0.5', false],
    ['text/markdown;q=0', false],
    ['text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', false],
    ['*/*', false],
    ['', false],
  ])('%j → %s', (accept, expected) => {
    expect(prefersMarkdown(accept)).toBe(expected)
  })
})

describe('routeFor', () => {
  it('knows the public pages, shared libraries, and private app pages', () => {
    expect(routeFor('/')).toMatchObject({ kind: 'doc', doc: { path: '/' } })
    expect(routeFor('/index')).toMatchObject({ kind: 'doc', doc: { path: '/' } })
    expect(routeFor('/docs')).toMatchObject({ kind: 'doc', doc: { path: '/docs' } })
    expect(routeFor('/u/Some-Reader')).toEqual({ kind: 'shared', handle: 'some-reader' })
    for (const path of ['/library', '/library/abc-123', '/garden', '/discover', '/brand']) {
      expect(routeFor(path).kind).toBe('private')
    }
    for (const path of ['/nope', '/u/', '/u/a', '/library/a/b', '/wp-admin']) {
      expect(routeFor(path).kind).toBe('missing')
    }
  })
})

describe('the HTML shell', () => {
  it('ships the home page’s head tags, so it matches what the server renders', () => {
    const start = SHELL.indexOf('<!-- page:head -->')
    const end = SHELL.indexOf('<!-- /page:head -->')
    const squash = (value: string) => value.replace(/\s+/g, ' ').trim()
    expect(squash(SHELL.slice(start + '<!-- page:head -->'.length, end))).toBe(
      squash(renderHead({ title: HOME_DOC.title, description: HOME_DOC.description, path: '/' })),
    )
  })

  it('keeps an empty #root just before the noscript note, where pages are injected', () => {
    expect(SHELL).toMatch(/<div id="root"><\/div>\s*<noscript>/)
  })
})

describe('handleSite', () => {
  let database: Awaited<ReturnType<typeof testDatabase>>
  let env: SiteEnv
  const passedOn: string[] = []
  const assets: Record<string, string> = { '/robots.txt': 'User-agent: *' }

  beforeAll(async () => {
    database = await testDatabase()
  })
  afterAll(() => database.dispose())
  beforeEach(async () => {
    await database.reset()
    passedOn.length = 0
    env = {
      DB: database.db,
      ASSETS: {
        fetch: async (input: RequestInfo | URL) => {
          const path = new URL(String(input instanceof Request ? input.url : input)).pathname
          return new Response(SHELL, {
            headers: { 'Content-Type': 'text/html' },
            status: path === '/' ? 200 : 200,
          })
        },
      } as unknown as Fetcher,
    }
  })

  /** Pages' own handling of what we pass on: real files, or the app shell for anything else. */
  const next = (path: string) => async () => {
    passedOn.push(path)
    const file = assets[path]
    return file
      ? new Response(file, { headers: { 'Content-Type': 'text/plain' } })
      : new Response(SHELL, { headers: { 'Content-Type': 'text/html' } })
  }
  const get = (
    path: string,
    accept = 'text/html,application/xhtml+xml,*/*;q=0.8',
    method = 'GET',
  ) =>
    handleSite(
      new Request(`https://little-alexandria.pages.dev${path}`, {
        method,
        headers: { Accept: accept },
      }),
      env,
      next(path),
    )

  it('serves the home page with its words in the raw HTML', async () => {
    const response = await get('/')
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    expect(response.headers.get('Vary')).toBe('Accept')
    expect(response.headers.get('Link')).toContain('</openapi.json>; rel="service-desc"')
    const html = await response.text()
    const root = /<div id="root">([\s\S]*?)<\/div>\s*<noscript>/.exec(html)![1]!
    expect(root).toContain('<h1>Every great reader deserves a great library.</h1>')
    expect(root.replace(/<[^>]+>/g, '').length).toBeGreaterThan(500)
    expect(html).toContain('"@type":"Organization"')
  })

  it('serves Markdown to clients that ask for it', async () => {
    const response = await get('/', 'text/markdown')
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
    expect(response.headers.get('Vary')).toBe('Accept')
    const markdown = await response.text()
    expect(markdown).toMatch(/^# Every great reader deserves a great library\.\n/)
    expect(markdown).toContain('(https://little-alexandria.pages.dev/docs)')
  })

  it('serves .md URLs as Markdown whatever the Accept header says', async () => {
    for (const [path, heading] of [
      ['/index.md', '# Every great reader'],
      ['/about.md', '# About Little Alexandria'],
      ['/docs.md', '# Little Alexandria API'],
      ['/privacy.md', '# Privacy'],
      ['/contact.md', '# Contact'],
    ] as const) {
      const response = await get(path)
      expect(response.headers.get('Content-Type'), path).toBe('text/markdown; charset=utf-8')
      expect(await response.text()).toMatch(new RegExp(`^${heading}`))
    }
  })

  it('gives each public page its own title, canonical URL, and content', async () => {
    const html = await (await get('/privacy')).text()
    expect(html).toContain('<title>Privacy · Little Alexandria</title>')
    expect(html).toContain(
      '<link rel="canonical" href="https://little-alexandria.pages.dev/privacy" />',
    )
    expect(html).toContain('<link rel="alternate" type="text/markdown" href="/privacy.md" />')
    expect(html).toContain('<h1>Privacy</h1>')
    expect(html).not.toContain('"@type":"Organization"')
  })

  it('answers unknown paths with a real 404, in HTML or Markdown', async () => {
    const html = await get('/some-path-that-does-not-exist')
    expect(html.status).toBe(404)
    expect(html.headers.get('X-Robots-Tag')).toBe('noindex')
    expect(await html.text()).toContain('<h1>This shelf is empty</h1>')

    const markdown = await get('/some-path-that-does-not-exist', 'text/markdown')
    expect(markdown.status).toBe(404)
    expect(markdown.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
    const body = await markdown.text()
    expect(body).toContain('# Not found')
    expect(body).toContain('https://little-alexandria.pages.dev/llms.txt')
    expect(body).toContain('https://little-alexandria.pages.dev/sitemap.xml')
  })

  it('passes real files on, and turns a missing file into a 404', async () => {
    const robots = await get('/robots.txt')
    expect(await robots.text()).toBe('User-agent: *')
    expect(passedOn).toEqual(['/robots.txt'])
    const missing = await get('/wp-login.php')
    expect(missing.status).toBe(404)
  })

  it('leaves the API to the API', async () => {
    await get('/api/auth/providers')
    await get('/api/library', 'application/json', 'POST')
    expect(passedOn).toEqual(['/api/auth/providers', '/api/library'])
  })

  it('redirects trailing slashes to the canonical path', async () => {
    const response = await get('/about/')
    expect(response.status).toBe(308)
    expect(response.headers.get('Location')).toBe('https://little-alexandria.pages.dev/about')
  })

  it('serves private app pages to browsers, but keeps them out of search', async () => {
    const response = await get('/library')
    expect(response.status).toBe(200)
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex')
    const html = await response.text()
    expect(html).toContain('<meta name="robots" content="noindex" />')
    expect(html).toContain('<h1>Your shelves</h1>')
  })

  it('lists a shared library’s books in HTML and Markdown, without notes', async () => {
    const store = createStore(database.db)
    const user = await store.upsertUser('google:reader', {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      avatarUrl: null,
    })
    await store.updateProfile(user.id, { handle: 'ada', isPublic: true })
    const book = {
      id: 'fixture:OL1W',
      source: 'fixture' as const,
      sourceId: 'OL1W',
      title: 'Piranesi',
      subtitle: null,
      authors: ['Susanna Clarke'],
      publishedYear: 2020,
      pageCount: 272,
      description: null,
      genres: [],
      coverUrl: null,
      isbn13: null,
      spineColor: null,
    }
    await store.addEntry(user.id, book, 'read', '2026-11-13', {
      rating: 5,
      notes: 'secret thoughts',
      finishedAt: '2026-11-01',
      finishedApprox: false,
      genreHint: null,
    })

    const html = await (await get('/u/ada')).text()
    expect(html).toContain('<title>Ada’s library · Little Alexandria</title>')
    expect(html).toContain('<li>Piranesi by Susanna Clarke (★★★★★)</li>')
    expect(html).not.toContain('secret thoughts')
    expect(html).not.toContain('ada@example.com')

    const markdown = await (await get('/u/ada.md')).text()
    expect(markdown).toContain('## Read (1)')
    expect(markdown).toContain('- Piranesi by Susanna Clarke (★★★★★), finished 2026-11-01')
    expect(markdown).not.toContain('secret thoughts')

    await store.updateProfile(user.id, { isPublic: false })
    const closed = await get('/u/ada', 'text/markdown')
    expect(closed.status).toBe(404)
    expect(await closed.text()).toContain('# This library is closed')
  })

  it('publishes llms.txt, openapi.json, and a sitemap with shared libraries', async () => {
    const llms = await get('/llms.txt')
    expect(llms.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
    expect(await llms.text()).toBe(llmsTxt())

    const spec = await get('/openapi.json')
    expect(spec.headers.get('Content-Type')).toBe('application/json; charset=utf-8')
    expect(((await spec.json()) as { info: { title: string } }).info.title).toBe(
      'Little Alexandria API',
    )

    const store = createStore(database.db)
    const user = await store.upsertUser('google:x', {
      name: 'Shared Reader',
      email: null,
      avatarUrl: null,
    })
    await store.updateProfile(user.id, { handle: 'shared-reader', isPublic: true })
    await store.upsertUser('google:y', { name: 'Private Reader', email: null, avatarUrl: null })
    const sitemap = await (await get('/sitemap.xml')).text()
    expect(sitemap).toContain('<loc>https://little-alexandria.pages.dev/docs</loc>')
    expect(sitemap).toContain('<loc>https://little-alexandria.pages.dev/u/shared-reader</loc>')
    expect(sitemap).not.toContain('private-reader')
  })
})

describe('llms.txt', () => {
  it('follows the llms.txt layout: H1, summary, details, then H2 link lists', () => {
    const text = llmsTxt()
    const lines = text.split('\n')
    expect(lines[0]).toBe('# Little Alexandria')
    expect(lines[2]).toMatch(/^> /)
    const sections = text.split(/\n## /).slice(1)
    expect(sections.map((section) => section.split('\n')[0])).toEqual([
      'When to use Little Alexandria',
      'Docs',
      'Optional',
    ])
    for (const section of sections) {
      const items = section.split('\n').filter((line) => line.startsWith('- '))
      expect(items.length).toBeGreaterThan(0)
      for (const item of items) expect(item).toMatch(/^- \[[^\]]+\]\([^)]+\)/)
    }
  })
})

describe('sitemapXml', () => {
  it('escapes and lists every page', () => {
    const xml = sitemapXml(['a-b'])
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset /)
    expect(xml.match(/<url>/g)).toHaveLength(6)
  })
})
