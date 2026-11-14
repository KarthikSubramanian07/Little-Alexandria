// The words on the site's public pages, kept in one place so the landing page,
// the HTML served to crawlers, and the Markdown served to agents never drift apart.
import type { SiteDoc } from './doc'

export const SITE = {
  name: 'Little Alexandria',
  origin: 'https://little-alexandria.pages.dev',
  tagline: 'A hand-drawn bookshelf and reading tracker',
  description:
    'A warm, hand-drawn home for the books you want to read, are reading, and have loved. Shelve books, keep notes, and watch your reading garden grow.',
  github: 'https://github.com/KarthikSubramanian07/Little-Alexandria',
  issues: 'https://github.com/KarthikSubramanian07/Little-Alexandria/issues',
  /** Where readers who like the site can tip the person who makes it. */
  coffee: 'https://buymeacoffee.com/winnerkarthik',
  /** Product terms, used for meta keywords and JSON-LD. Each one appears on the home page. */
  keywords: ['reading tracker', 'bookshelf', 'reading garden', 'reading goal'],
} as const

export const HOME = {
  kicker: 'a reading room, planted by you',
  titleLead: 'Every great reader deserves a ',
  titleEmphasis: 'great library',
  intro:
    'Little Alexandria is a warm, hand-drawn home for the books you want to read, the one on your nightstand, and the ones you’ve loved. Shelve them, scribble in the margins, and watch a garden grow from everything you finish.',
  promise: 'Free, private to you, and no newsletter. Your shelves are yours alone.',
  chapters: [
    {
      numeral: 'i.',
      title: 'Shelve',
      headline: ['Every book in the stacks,', 'one tap from your shelf.'],
      text: 'Search every book in the stacks and set it on a shelf in one click: Want to Read, Currently Reading, or Read. Drag books between shelves like you would at home.',
    },
    {
      numeral: 'ii.',
      title: 'Annotate',
      headline: ['A catalogue card', 'for every book you keep.'],
      text: 'Each book opens into its own catalogue card. Give it stars, note the day you started and finished, and keep notes in the margin.',
    },
    {
      numeral: 'iii.',
      title: 'Grow',
      headline: ['Finish a book,', 'plant a flower.'],
      text: 'Every finished book plants a flower in your reading garden, coloured like its cover. Set a yearly goal and watch the sun come up.',
    },
  ],
  quote: {
    text: '“If you have a garden and a library, you have everything you need.”',
    cite: 'Marcus Tullius Cicero, who would have liked this place',
  },
  caption: 'yours, give or take a few hundred books',
  howHeadline: ['Three small rituals,', 'one whole library.'],
  closing: ['Your shelves are', 'waiting for you.'],
  footer:
    'Little Alexandria · a hand-drawn bookshelf and reading tracker, made with love for libraries',
} as const

/** The footer's links, in order. */
export const FOOTER_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Contact', href: '/contact' },
  { label: 'API', href: '/docs' },
  { label: 'GitHub', href: SITE.github },
  { label: 'Buy me a coffee', href: SITE.coffee },
] as const

export const HOME_DOC: SiteDoc = {
  path: '/',
  title: `${SITE.name} · ${SITE.tagline}`,
  heading: `${HOME.titleLead}${HOME.titleEmphasis}.`,
  description: SITE.description,
  kicker: HOME.kicker,
  blocks: [
    { type: 'p', text: HOME.intro },
    {
      type: 'p',
      text: `[Sign in with Google](/api/auth/google) to open your library. ${HOME.promise}`,
    },
    { type: 'h2', text: 'How it works' },
    ...HOME.chapters.flatMap((chapter) => [
      { type: 'h3' as const, text: chapter.title },
      { type: 'p' as const, text: chapter.text },
    ]),
    { type: 'p', text: `${HOME.quote.text} ${HOME.quote.cite}.` },
    {
      type: 'p',
      text: `${HOME.footer}. Set a reading goal for the year, and every book you finish grows your reading garden.`,
    },
    { type: 'h2', text: 'More about Little Alexandria' },
    {
      type: 'ul',
      items: [
        '[About](/about): who makes it, and how it works.',
        '[Privacy](/privacy): what is stored, and how to take it with you or delete it.',
        '[Contact](/contact): bugs, ideas, and security reports.',
        '[Little Alexandria API](/docs): endpoints, authentication, and rate limits.',
        `[Source code on GitHub](${SITE.github}), MIT licensed.`,
      ],
    },
  ],
}

export const ABOUT_DOC: SiteDoc = {
  path: '/about',
  title: `About · ${SITE.name}`,
  heading: 'About Little Alexandria',
  kicker: 'who keeps the lights on',
  description:
    'Little Alexandria is an independent, open-source bookshelf and reading tracker, made by hand for people who love books.',
  blocks: [
    {
      type: 'p',
      text: 'Little Alexandria is a personal bookshelf and reading tracker. You keep three shelves (Want to Read, Currently Reading, and Read), give each book stars, dates, and notes, and set a reading goal for the year. Every book you finish plants a flower, in the colour of its cover, in a crayon-drawn reading garden.',
    },
    {
      type: 'p',
      text: 'Most reading trackers look like spreadsheets that wandered into a bookshop. This one tries to feel like the shop itself: covers standing on wooden shelves, a card catalogue for every book, and a rubber stamp when you finish one.',
    },
    { type: 'h2', text: 'Who makes it' },
    {
      type: 'p',
      text: `Little Alexandria is an independent project, built and maintained by one developer. It is not a company and has no investors, advertisers, or partners. The [source code is public on GitHub](${SITE.github}) under the MIT licence, so anyone can read exactly how it works, suggest changes, or run their own copy. It is free, with no ads and no paid tier; if it earns a place in your reading life, you can [buy me a coffee](${SITE.coffee}).`,
    },
    { type: 'h2', text: 'How it works' },
    {
      type: 'ul',
      items: [
        'Book details and covers come from [Open Library](https://openlibrary.org), a project of the Internet Archive, and optionally from Google Books.',
        'Film and television adaptations come from [Wikidata](https://www.wikidata.org).',
        'The site runs on Cloudflare Pages, with your shelves stored in a Cloudflare D1 database.',
        'You sign in with Google. There are no passwords to leak.',
      ],
    },
    { type: 'h2', text: 'Principles' },
    {
      type: 'ul',
      items: [
        'Your shelves are private unless you choose to share them, and your notes are never shown to anyone.',
        'No ads, no tracking scripts, and no newsletter.',
        'You can download everything as a CSV, or delete your account, at any time.',
        'Accessible to everyone: keyboard and screen-reader friendly, with reduced motion respected.',
      ],
    },
    {
      type: 'p',
      text: 'Questions or ideas? See the [contact page](/contact), or read the [privacy notice](/privacy).',
    },
  ],
}

export const PRIVACY_DOC: SiteDoc = {
  path: '/privacy',
  title: `Privacy · ${SITE.name}`,
  heading: 'Privacy',
  kicker: 'what we keep, and what we don’t',
  description:
    'What Little Alexandria stores about you, why, who else is involved, and how to export or delete it. Last updated 13 November 2026.',
  blocks: [
    {
      type: 'p',
      text: 'Little Alexandria keeps only what it needs to run your bookshelf. It has no advertising, no analytics, and no tracking scripts, and it never sells or shares your data. This notice was last updated on 13 November 2026.',
    },
    { type: 'h2', text: 'What we store' },
    {
      type: 'ul',
      items: [
        '**Your account:** the name, email address, and profile photo address that Google shares when you sign in, plus Google’s identifier for your account. Your email is never shown to anyone.',
        '**Your shelves:** the books you add, which shelf each is on, and the ratings, start and finish dates, and notes you write.',
        '**Your reading goals:** one number per year, if you set one.',
        '**Your public address:** a handle such as /u/your-name, and whether you have chosen to share your shelves.',
        '**Sessions:** a fingerprint (a SHA-256 hash) of each sign-in, with its expiry date, so the session cookie in your browser can be checked.',
      ],
    },
    { type: 'h2', text: 'Cookies and local storage' },
    {
      type: 'ul',
      items: [
        '`la_session` keeps you signed in for 30 days. It is HttpOnly, so scripts cannot read it.',
        'Three short-lived cookies protect the Google sign-in step and expire after ten minutes.',
        'Your browser’s local storage remembers your light or dark theme, and the progress of an import if you close the tab partway through.',
        'There are no advertising or analytics cookies.',
      ],
    },
    { type: 'h2', text: 'Who else is involved' },
    {
      type: 'ul',
      items: [
        '**Google** handles sign-in. Google’s own privacy policy covers what happens on its sign-in page.',
        '**Cloudflare** hosts the site and the database. Like any web host, it processes IP addresses to deliver pages and stop abuse.',
        '**Open Library, Google Books, and Wikidata** answer book searches. The search words and book identifiers are sent from our server, never with your name or email. Covers are fetched through our server, so those services do not see your IP address.',
      ],
    },
    { type: 'h2', text: 'Sharing your shelves' },
    {
      type: 'p',
      text: 'Your library is private until you turn on sharing. When you do, anyone with the link to /u/your-handle can see your name, profile photo, books, shelves, ratings, and reading dates. Your notes and email stay private either way. Turning sharing off takes the page down straight away.',
    },
    { type: 'h2', text: 'Your choices' },
    {
      type: 'ul',
      items: [
        '**Export:** download your whole library as a CSV from the profile menu, in a format Goodreads and StoryGraph can import.',
        '**Delete:** “Delete my account” in the profile menu permanently removes your account, sessions, shelves, notes, and goals at once.',
        'Little Alexandria is not directed at children under 13.',
      ],
    },
    {
      type: 'p',
      text: 'Questions about your data? See the [contact page](/contact).',
    },
  ],
}

export const CONTACT_DOC: SiteDoc = {
  path: '/contact',
  title: `Contact · ${SITE.name}`,
  heading: 'Contact',
  kicker: 'leave a note at the front desk',
  description:
    'How to report a bug, suggest an idea, report a security problem, or ask about your data at Little Alexandria.',
  blocks: [
    {
      type: 'p',
      text: 'Little Alexandria is an independent, open-source project, and all of its conversations happen in the open on GitHub. That keeps every question answerable, searchable, and visible to the next person who has the same one.',
    },
    { type: 'h2', text: 'Bugs and ideas' },
    {
      type: 'p',
      text: `[Open an issue on GitHub](${SITE.issues}). Say what you expected, what happened instead, and which browser and device you were using. A screenshot helps a great deal. Ideas and feature requests are just as welcome.`,
    },
    { type: 'h2', text: 'Security problems' },
    {
      type: 'p',
      text: `Please don’t post security problems in a public issue. Report them privately through [GitHub’s security advisories](${SITE.github}/security/advisories/new) for this repository instead, and they will be looked at first.`,
    },
    { type: 'h2', text: 'Your data' },
    {
      type: 'p',
      text: 'You can export your library or delete your account yourself, at any time, from the profile menu once you are signed in. Both take effect straight away. The [privacy notice](/privacy) explains exactly what is stored.',
    },
    { type: 'h2', text: 'Developers and agents' },
    {
      type: 'p',
      text: 'The [Little Alexandria API docs](/docs) describe every endpoint, and [llms.txt](/llms.txt) explains when an AI agent should use this site and how.',
    },
  ],
}

export const DOCS_DOC: SiteDoc = {
  path: '/docs',
  title: `Little Alexandria API · Docs`,
  heading: 'Little Alexandria API',
  kicker: 'for developers and agents',
  description:
    'The Little Alexandria API: a JSON HTTP API for reading shared bookshelves and managing your own. Endpoints, authentication, errors, and rate limits.',
  blocks: [
    {
      type: 'p',
      text: 'The Little Alexandria API is the same JSON HTTP API the app itself uses. Anyone can read a shared library without signing in. Everything else acts on the signed-in reader’s own shelves.',
    },
    {
      type: 'ul',
      items: [
        '**Base URL:** `https://little-alexandria.pages.dev/api`',
        '**OpenAPI 3.1 spec:** [/openapi.json](/openapi.json)',
        '**Guide for AI agents:** [/llms.txt](/llms.txt)',
        '**Every page as Markdown:** send `Accept: text/markdown`, or add `.md` to the path, as in [/docs.md](/docs.md).',
      ],
    },
    { type: 'h2', text: 'Authentication', id: 'authentication' },
    {
      type: 'p',
      text: 'Public endpoints need no credentials. Reader endpoints use the `la_session` cookie that [Google sign-in](/api/auth/google) sets, so they work from a browser session rather than with API keys. Requests that change data must also send an `Origin` header matching the site, which stops other websites from acting on a reader’s behalf.',
    },
    { type: 'h2', text: 'Public endpoints', id: 'public' },
    {
      type: 'ul',
      items: [
        '`GET /api/u/{handle}`: a shared library: the reader’s public profile, books, and reading stats. Returns 404 unless the reader has turned sharing on.',
        '`GET /api/auth/providers`: which sign-in methods are switched on.',
        '`GET /api/cover?src={url}`: a book cover, proxied from Open Library or Google Books.',
      ],
    },
    {
      type: 'code',
      lang: 'bash',
      text: 'curl https://little-alexandria.pages.dev/api/u/HANDLE',
    },
    {
      type: 'p',
      text: 'A shared library is also readable as Markdown, which suits agents best:',
    },
    {
      type: 'code',
      lang: 'bash',
      text: "curl -H 'Accept: text/markdown' https://little-alexandria.pages.dev/u/HANDLE",
    },
    { type: 'h2', text: 'Reader endpoints', id: 'reader' },
    {
      type: 'ul',
      items: [
        '`GET /api/auth/me`: the signed-in reader, or `null`.',
        '`GET /api/search?q={query}`: search the catalogue.',
        '`GET /api/library`: every book on your shelves, and your goals.',
        '`POST /api/library`: shelve a book from a search result.',
        '`PATCH /api/library/{id}`: move a book, rate it, date it, or write notes.',
        '`DELETE /api/library/{id}`: take a book off your shelves.',
        '`GET /api/library/{id}/related`: more by the author, similar books, and adaptations.',
        '`GET /api/books/{id}/about`: reading time, readers’ ratings, the opening lines, the story, and the author. Public.',
        '`PUT /api/goals/{year}`: set a reading goal.',
        '`GET /api/stats?year={year}`: books and pages read, by month and genre.',
        '`GET /api/discover`: recommendations from your favourite authors and genres.',
        '`POST /api/import`: import up to six rows of a reading list at a time.',
        '`GET /api/export`: download your library as a CSV.',
        '`PATCH /api/me`: change your handle, or turn sharing on and off.',
        '`DELETE /api/me`: delete your account and everything in it.',
      ],
    },
    {
      type: 'code',
      lang: 'bash',
      text: [
        'curl -X PATCH https://little-alexandria.pages.dev/api/library/ENTRY_ID \\',
        "  -H 'Content-Type: application/json' \\",
        "  -H 'Origin: https://little-alexandria.pages.dev' \\",
        "  -b 'la_session=YOUR_SESSION' \\",
        `  -d '{"shelf":"read","rating":5}'`,
      ].join('\n'),
    },
    { type: 'h2', text: 'Errors', id: 'errors' },
    {
      type: 'p',
      text: 'Errors come back as JSON with a readable message, such as `{"error": "Sign in to continue"}`, and a matching status: 400 for a bad request, 401 when signed out, 403 for a cross-origin write, 404 when something isn’t there, 409 for a conflict such as a book already on your shelves, 429 when rate limited, and 503 when the book catalogue is busy.',
    },
    { type: 'h2', text: 'Rate limits', id: 'rate-limits' },
    {
      type: 'p',
      text: 'Each client may make 600 API requests a minute, and 60 imports (`POST /api/import`) a minute, since each one looks books up in the catalogues. Cover images have their own allowance of 1,200 a minute and carry no rate-limit headers. Every other response says where you stand, using the IETF RateLimit header fields: `RateLimit-Policy` and `RateLimit`, plus the older `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` for tools that expect them. Past the limit, the API answers 429 with a `Retry-After` header giving the seconds to wait. Limits are counted per server instance, so treat them as a ceiling rather than a guarantee.',
    },
    {
      type: 'code',
      lang: 'http',
      text: [
        'RateLimit-Policy: "default";q=600;w=60',
        'RateLimit: "default";r=598;t=42',
        'RateLimit-Limit: 600',
        'RateLimit-Remaining: 598',
        'RateLimit-Reset: 42',
      ].join('\n'),
    },
    { type: 'h2', text: 'Machine-readable files', id: 'files' },
    {
      type: 'ul',
      items: [
        '[/openapi.json](/openapi.json): the OpenAPI 3.1 description of every endpoint.',
        '[/llms.txt](/llms.txt): when and how AI agents should use Little Alexandria.',
        '[/sitemap.xml](/sitemap.xml) and [/robots.txt](/robots.txt).',
      ],
    },
  ],
}

/** Every public page, by path. */
export const SITE_DOCS: SiteDoc[] = [HOME_DOC, ABOUT_DOC, PRIVACY_DOC, CONTACT_DOC, DOCS_DOC]
