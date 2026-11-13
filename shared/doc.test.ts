import { describe, expect, it } from 'vitest'
import { docTextLength, docToHtml, docToMarkdown, parseInline, type SiteDoc } from './doc'
import { HOME, HOME_DOC, SITE, SITE_DOCS } from './site'

describe('parseInline', () => {
  it('finds links, code, and bold among plain text', () => {
    expect(parseInline('See [the docs](/docs), run `curl`, **now**.')).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'link', text: 'the docs', href: '/docs' },
      { kind: 'text', text: ', run ' },
      { kind: 'code', text: 'curl' },
      { kind: 'text', text: ', ' },
      { kind: 'bold', text: 'now' },
      { kind: 'text', text: '.' },
    ])
  })

  it('leaves text without marks alone', () => {
    expect(parseInline('Just words.')).toEqual([{ kind: 'text', text: 'Just words.' }])
  })
})

const sample: SiteDoc = {
  path: '/sample',
  title: 'Sample',
  heading: 'A <sample>',
  description: 'For tests.',
  kicker: 'hello',
  blocks: [
    { type: 'h2', text: 'Part one', id: 'one' },
    { type: 'p', text: 'Go [home](/) or [away](https://example.com) & `x<y`.' },
    { type: 'ul', items: ['**a**', 'b'] },
    { type: 'code', lang: 'bash', text: 'echo "<hi>"' },
  ],
}

describe('docToMarkdown', () => {
  it('writes one H1, the description, and absolute links', () => {
    const markdown = docToMarkdown(sample, 'https://site.test')
    expect(markdown).toBe(
      [
        '# A <sample>',
        '',
        '> For tests.',
        '',
        '## Part one',
        '',
        'Go [home](https://site.test/) or [away](https://example.com) & `x<y`.',
        '',
        '- **a**',
        '- b',
        '',
        '```bash',
        'echo "<hi>"',
        '```',
        '',
      ].join('\n'),
    )
  })
})

describe('docToHtml', () => {
  it('escapes everything and keeps headings semantic', () => {
    const html = docToHtml(sample)
    expect(html).toContain('<h1>A &lt;sample&gt;</h1>')
    expect(html).toContain('<h2 id="one">Part one</h2>')
    expect(html).toContain('<a href="/">home</a>')
    expect(html).toContain('&amp; <code>x&lt;y</code>')
    expect(html).toContain('<pre><code>echo &quot;&lt;hi&gt;&quot;</code></pre>')
    expect(html).not.toContain('<sample>')
  })
})

describe('the public pages', () => {
  it.each(SITE_DOCS.map((doc) => [doc.path, doc] as const))(
    '%s carries real content',
    (_path, doc) => {
      expect(docTextLength(doc)).toBeGreaterThanOrEqual(500)
      const html = docToHtml(doc)
      expect(html.match(/<h1>/g)).toHaveLength(1)
      // Heading levels never skip: an h3 always follows an h2.
      const levels = [...html.matchAll(/<h([1-6])/g)].map((match) => Number(match[1]))
      levels.forEach((level, index) => {
        if (index > 0) expect(level - levels[index - 1]!).toBeLessThanOrEqual(1)
      })
    },
  )

  it('every page has a distinct path and title', () => {
    expect(new Set(SITE_DOCS.map((doc) => doc.path)).size).toBe(SITE_DOCS.length)
    expect(new Set(SITE_DOCS.map((doc) => doc.title)).size).toBe(SITE_DOCS.length)
  })

  it('the home page says what the landing page says', () => {
    const markdown = docToMarkdown(HOME_DOC, SITE.origin)
    expect(markdown).toContain(`# ${HOME.titleLead}${HOME.titleEmphasis}.`)
    expect(markdown).toContain(HOME.intro)
    for (const chapter of HOME.chapters) expect(markdown).toContain(chapter.text)
  })

  it('every product keyword appears in the home page text', () => {
    const text = docToMarkdown(HOME_DOC, SITE.origin).toLowerCase() + HOME_DOC.title.toLowerCase()
    for (const keyword of SITE.keywords) expect(text).toContain(keyword)
  })

  it('the API docs are titled with the product name and "API"', () => {
    const docs = SITE_DOCS.find((doc) => doc.path === '/docs')!
    expect(docs.heading).toBe('Little Alexandria API')
    expect(docs.title).toContain('Little Alexandria API')
  })
})
