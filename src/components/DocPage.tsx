import { Link } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import { parseInline, type Block, type SiteDoc } from '../../shared/doc'
import { FOOTER_LINKS, HOME } from '../../shared/site'
import { ThemeToggle } from './AppShell'
import { Wordmark } from './Wordmark'

const ROUTES = new Set(['/', '/about', '/privacy', '/contact', '/docs'])

function SmartLink({ href, children }: { href: string; children: ReactNode }) {
  const className =
    'underline decoration-line-strong underline-offset-4 transition hover:text-ink hover:decoration-moss'
  if (ROUTES.has(href)) {
    return (
      <Link to={href as '/about'} className={className}>
        {children}
      </Link>
    )
  }
  const external = /^https?:/.test(href)
  return (
    <a href={href} className={className} {...(external ? { rel: 'noreferrer' } : {})}>
      {children}
    </a>
  )
}

/** Inline text with its [links](/x), `code`, and **bold** marks. */
function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, index) => {
        switch (part.kind) {
          case 'text':
            return part.text
          case 'bold':
            return (
              <strong key={index} className="font-semibold text-ink">
                {part.text}
              </strong>
            )
          case 'code':
            return (
              <code
                key={index}
                className="rounded-md bg-paper-deep px-1.5 py-0.5 font-mono text-[0.85em] text-ink"
              >
                {part.text}
              </code>
            )
          case 'link':
            return (
              <SmartLink key={index} href={part.href}>
                {part.text}
              </SmartLink>
            )
        }
      })}
    </>
  )
}

function DocBlock({ block, example }: { block: Block; example: number }) {
  switch (block.type) {
    case 'h2':
      return (
        <h2
          id={block.id}
          className="mt-12 scroll-mt-8 font-display text-3xl font-medium tracking-tight text-ink"
        >
          {block.text}
        </h2>
      )
    case 'h3':
      return <h3 className="mt-8 font-display text-2xl font-medium text-ink">{block.text}</h3>
    case 'p':
      return (
        <p className="mt-4">
          <InlineText text={block.text} />
        </p>
      )
    case 'ul':
      return (
        <ul role="list" className="mt-4 space-y-2.5 pl-1">
          {block.items.map((item) => (
            <li key={item} className="relative pl-6">
              <span
                aria-hidden
                className="absolute top-[0.05em] left-0 font-hand text-xl text-moss"
              >
                ~
              </span>
              <InlineText text={item} />
            </li>
          ))}
        </ul>
      )
    case 'code':
      return (
        // Long lines scroll sideways on phones, so the block takes focus for keyboard scrolling.
        <pre
          tabIndex={0}
          role="region"
          aria-label={`Example ${example}`}
          className="mt-4 overflow-x-auto rounded-2xl border border-line bg-paper-deep px-5 py-4 font-mono text-sm leading-relaxed text-ink"
        >
          <code>{block.text}</code>
        </pre>
      )
  }
}

/** The site's footer: what this is, and where else to go. */
export function SiteFooter() {
  return (
    <footer className="flex flex-col gap-4 border-t border-line py-8 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between">
      <p>{HOME.footer}</p>
      <nav aria-label="Site">
        <ul role="list" className="flex flex-wrap gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((item) => (
            <li key={item.href}>
              {ROUTES.has(item.href) ? (
                <Link
                  to={item.href as '/about'}
                  className="inline-block underline-offset-4 hover:text-ink hover:underline pointer-coarse:min-w-11 pointer-coarse:px-1.5 pointer-coarse:py-2.5 pointer-coarse:text-center"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  href={item.href}
                  rel="noreferrer"
                  className="inline-block underline-offset-4 hover:text-ink hover:underline pointer-coarse:min-w-11 pointer-coarse:px-1.5 pointer-coarse:py-2.5 pointer-coarse:text-center"
                >
                  {item.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  )
}

/** A plain, readable page of words: About, Privacy, Contact, and the API docs. */
export function DocPage({ doc }: { doc: SiteDoc }) {
  useEffect(() => {
    document.title = doc.title
  }, [doc.title])

  return (
    <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
      <header className="flex items-center justify-between py-5">
        <Link to="/" aria-label="Little Alexandria home" className="rounded-lg">
          <Wordmark />
        </Link>
        <ThemeToggle />
      </header>
      <main
        id="main"
        className="mx-auto max-w-2xl pt-8 pb-24 text-lg leading-relaxed text-ink-soft md:pt-14"
      >
        {doc.kicker && <p className="font-hand text-2xl text-moss">{doc.kicker}</p>}
        <h1 className="mt-2 font-display text-[clamp(2.4rem,6vw,3.75rem)] leading-[1] font-medium tracking-[-0.02em] text-balance text-ink">
          {doc.heading}
        </h1>
        {doc.blocks.map((block, index) => (
          <DocBlock
            key={index}
            block={block}
            example={doc.blocks.slice(0, index + 1).filter((b) => b.type === 'code').length}
          />
        ))}
      </main>
      <SiteFooter />
    </div>
  )
}
