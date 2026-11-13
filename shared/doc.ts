// A tiny document format for the site's public pages (home, about, privacy,
// contact, API docs). One source renders three ways: Markdown for agents,
// plain HTML for crawlers that run no JavaScript, and React for everyone else.
// Inline text understands three marks: [links](/path), `code`, and **bold**.

export type Block =
  | { type: 'h2' | 'h3'; text: string; id?: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'code'; lang?: string; text: string }

export interface SiteDoc {
  /** The page's path, e.g. '/about'. */
  path: string
  /** The <title>, also the Markdown front heading. */
  title: string
  /** The single H1 on the page. */
  heading: string
  description: string
  /** A short hand-lettered line above the heading. */
  kicker?: string
  blocks: Block[]
}

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'code'; text: string }
  | { kind: 'bold'; text: string }

const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g

/** Split inline text into plain runs, links, code, and bold. */
export function parseInline(text: string): Inline[] {
  const parts: Inline[] = []
  let last = 0
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0
    if (index > last) parts.push({ kind: 'text', text: text.slice(last, index) })
    if (match[1] !== undefined && match[2] !== undefined) {
      parts.push({ kind: 'link', text: match[1], href: match[2] })
    } else if (match[3] !== undefined) {
      parts.push({ kind: 'code', text: match[3] })
    } else if (match[4] !== undefined) {
      parts.push({ kind: 'bold', text: match[4] })
    }
    last = index + match[0].length
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) })
  return parts
}

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** Site-relative links become absolute, so Markdown still works out of context. */
const absolute = (href: string, origin: string) =>
  href.startsWith('/') ? `${origin}${href}` : href

function inlineHtml(text: string) {
  return parseInline(text)
    .map((part) => {
      switch (part.kind) {
        case 'text':
          return escapeHtml(part.text)
        case 'code':
          return `<code>${escapeHtml(part.text)}</code>`
        case 'bold':
          return `<strong>${escapeHtml(part.text)}</strong>`
        case 'link':
          return `<a href="${escapeHtml(part.href)}">${escapeHtml(part.text)}</a>`
      }
    })
    .join('')
}

function inlineMarkdown(text: string, origin: string) {
  return parseInline(text)
    .map((part) => {
      switch (part.kind) {
        case 'text':
          return part.text
        case 'code':
          return `\`${part.text}\``
        case 'bold':
          return `**${part.text}**`
        case 'link':
          return `[${part.text}](${absolute(part.href, origin)})`
      }
    })
    .join('')
}

/** The page as Markdown, with absolute links, for agents and `.md` URLs. */
export function docToMarkdown(doc: SiteDoc, origin: string): string {
  const out: string[] = [`# ${doc.heading}`, '', `> ${doc.description}`]
  for (const block of doc.blocks) {
    out.push('')
    switch (block.type) {
      case 'h2':
        out.push(`## ${block.text}`)
        break
      case 'h3':
        out.push(`### ${block.text}`)
        break
      case 'p':
        out.push(inlineMarkdown(block.text, origin))
        break
      case 'ul':
        out.push(...block.items.map((item) => `- ${inlineMarkdown(item, origin)}`))
        break
      case 'code':
        out.push(`\`\`\`${block.lang ?? ''}`, block.text, '```')
        break
    }
  }
  return `${out.join('\n')}\n`
}

/** The page as plain semantic HTML, served inside #root before JavaScript runs. */
export function docToHtml(doc: SiteDoc): string {
  const out: string[] = []
  if (doc.kicker) out.push(`<p>${escapeHtml(doc.kicker)}</p>`)
  out.push(`<h1>${escapeHtml(doc.heading)}</h1>`)
  for (const block of doc.blocks) {
    switch (block.type) {
      case 'h2':
      case 'h3': {
        const id = block.id ? ` id="${escapeHtml(block.id)}"` : ''
        out.push(`<${block.type}${id}>${inlineHtml(block.text)}</${block.type}>`)
        break
      }
      case 'p':
        out.push(`<p>${inlineHtml(block.text)}</p>`)
        break
      case 'ul':
        out.push(`<ul>${block.items.map((item) => `<li>${inlineHtml(item)}</li>`).join('')}</ul>`)
        break
      case 'code':
        out.push(`<pre><code>${escapeHtml(block.text)}</code></pre>`)
        break
    }
  }
  return out.join('\n')
}

/** Plain text length of a document, for checking pages carry real content. */
export function docTextLength(doc: SiteDoc): number {
  const strip = (text: string) =>
    parseInline(text)
      .map((part) => part.text)
      .join('')
  return [
    doc.heading,
    ...doc.blocks.flatMap((block) => ('items' in block ? block.items : [block.text])),
  ]
    .map(strip)
    .join(' ').length
}
