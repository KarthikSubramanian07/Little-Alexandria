<div align="center">

<img src="public/og.png" alt="Little Alexandria: every great reader deserves a great library" width="720" />

# Little Alexandria

**A warm, hand-drawn home for the books you want to read, the one on your nightstand, and the ones you've loved.**

Shelve them, scribble in the margins, and watch a garden grow from everything you finish.

[little-alexandria.pages.dev](https://little-alexandria.pages.dev) ·
[How it's built](#how-its-built) ·
[Run it yourself](#run-it-yourself)

![React 19](https://img.shields.io/badge/React-19-2f4a3a?style=flat-square)
![Cloudflare Pages + D1](https://img.shields.io/badge/Cloudflare-Pages%20%2B%20D1-7d5130?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-2f4058?style=flat-square)
![Motion](https://img.shields.io/badge/Motion-animated-9a3d3d?style=flat-square)
![License: MIT](https://img.shields.io/badge/license-MIT-d9a441?style=flat-square)

`bookshelf` · `reading-tracker` · `goodreads-alternative` · `cloudflare-pages` · `d1` · `react` · `hono` · `motion`

</div>

---

## Why it exists

Most reading trackers look like spreadsheets that wandered into a bookshop. This one tries to feel like the shop itself: covers standing on wooden shelves, a card catalogue for every book, a rubber stamp when you finish one, and a crayon-drawn garden that blooms a flower, in the colour of the book's cover, for every book you've read this year.

It's personal by default and shareable when you want: flip one switch and anyone with your link can wander your shelves, minus your notes.

## What it does

|                         |                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Three shelves**       | Want to Read, Currently Reading, Read. Drag books between them, or use the move menu, which works from a keyboard or a thumb.                            |
| **Search**              | Every book in Open Library (and Google Books, given a key), debounced, one click to shelve.                                                              |
| **Catalogue cards**     | Covers fly from the shelf into a detail card: stars, start and finish dates that fill themselves in, notes that save themselves, and a "FINISHED" stamp. |
| **More like this**      | The author's other books, books like it, and real film and TV adaptations from Wikidata.                                                                 |
| **Discover**            | Picks from the authors you rated highest and the genres you actually read.                                                                               |
| **Your reading garden** | A flower per finished book, coloured from its cover and sized by its page count, under a sun that fills with your yearly goal. Fireflies after dark.     |
| **Import**              | Goodreads and StoryGraph exports, or any "title, author" list. Books drop onto the shelves as they're matched; the import resumes if you close the tab.  |
| **Share**               | `/u/<you>` shows your shelves and garden to anyone, invites them to start their own, and unfurls into a proper link preview.                             |
| **Day and night**       | A sunlit reading room, or the same room after hours under one warm lamp. Reduced motion respected throughout.                                            |

## How it's built

```
Browser (React 19, TanStack Router + Query, Motion, dnd-kit, Tailwind 4)
   │  same-origin fetch, HttpOnly session cookie
   ▼
Cloudflare Pages
   ├── static assets (dist/)                   the app, fonts, art
   ├── functions/_middleware.ts ───────────▶  server/site.ts   every page's words in the raw HTML,
   │                                             Markdown on request, real 404s, llms.txt, openapi.json
   ├── functions/api/[[route]].ts ── Hono ──▶  server/app.ts
   │                                             ├── auth.ts      Google OAuth (Arctic, PKCE) + guest sign-in for dev
   │                                             ├── session.ts   random tokens, only their SHA-256 is stored
   │                                             ├── store.ts     every SQL statement in the app
   │                                             ├── library.ts   pure rules: positions, patches, stats
   │                                             ├── related.ts   more-like-this, Discover, Wikidata adaptations
   │                                             ├── ratelimit.ts IETF RateLimit headers, 429 + Retry-After
   │                                             ├── openapi.ts   the OpenAPI 3.1 spec, checked against the routes
   │                                             └── sources/     Open Library, Google Books, matching, genres
   ▼
D1 (SQLite at the edge)
```

### The data model

Five small tables; the constraints carry the rules so the code doesn't have to remember them.

| Table           | What it holds                                                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `users`         | Google identity, name, photo, a unique public `handle`, and `is_public` (off until you share).                                                                                                                                                         |
| `sessions`      | SHA-256 of each session token and its expiry, so a leaked table can't be replayed.                                                                                                                                                                     |
| `books`         | A shared catalogue: each book stored once, however many readers shelve it. Only the server writes here, from metadata it fetched itself.                                                                                                               |
| `user_books`    | One row per book on your shelves. `UNIQUE(user_id, book_id)` is what makes "a book lives on one shelf" true. Ratings are checked 1–5, dates must be real, a finish can't precede a start, and `finished_approx` marks imports that only knew the year. |
| `reading_goals` | One target per reader per year.                                                                                                                                                                                                                        |

Shelf order uses **fractional indexing**: moving a book writes one row, never the whole shelf. Every library query is scoped by the user id the session resolved, and writes must come from our own origin.

### Choices worth explaining

- **Covers go through our own origin** (`/api/cover`, allowlisted hosts only), so the browser can sample each cover's colour for the book's spine and its flower.
- **Library writes are optimistic and serialised.** Moves appear instantly and roll back if the server says no; they run one at a time so a flurry of drags can't land out of order.
- **Imports run outside React** in small batches, so they keep going while dialogs close, pause and resume, and stay within the Workers subrequest budget. Matching trusts Open Library's author filter (it knows Лев Толстой is Leo Tolstoy), falls back to forgiving searches for typos, and prefers the edition everyone owns over the study guide nobody does.
- **The art is code.** Every drawing is SVG passed through a shared wobble filter and a crayon-grain filter; flowers are seeded by book, so each is unique and never changes.

### For agents and crawlers

The words on every public page (home, [about](https://little-alexandria.pages.dev/about), [privacy](https://little-alexandria.pages.dev/privacy), [contact](https://little-alexandria.pages.dev/contact), [API docs](https://little-alexandria.pages.dev/docs), and shared libraries) come from one source, `shared/site.ts`, and are rendered three ways: React for people, plain HTML inside `#root` for crawlers that run no JavaScript, and Markdown for agents that send `Accept: text/markdown` or add `.md` to a path. Unknown paths return a real 404. [`/llms.txt`](https://little-alexandria.pages.dev/llms.txt) says when an agent should use the site, and [`/openapi.json`](https://little-alexandria.pages.dev/openapi.json) describes every endpoint; a test fails if a route is missing from it, or if a real response doesn't match its schema.

### Accessibility

Every page is checked with axe against WCAG 2.2 AA in both themes, on desktop and phone, as part of the end-to-end suite. Text meets 4.5:1 contrast, form fields have 3:1 borders and visible focus rings, controls are named the way they read (so speech input works), and reduced motion is respected throughout.

## Run it yourself

You'll need Node 22+ and pnpm.

```bash
pnpm install
cp .dev.vars.example .dev.vars   # DEV_LOGIN=1 enables "Look around as a guest"
pnpm dev                         # Vite on :5173, Pages Functions + local D1 on :8788
```

Open <http://localhost:5173> and step in as a guest. Google sign-in needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.dev.vars`, with `http://localhost:5173/api/auth/google/callback` as an authorised redirect URI.

| Command                                         | What it does                                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `pnpm test`                                     | Unit and API tests (Vitest). API tests run against a real in-memory D1.                                              |
| `pnpm test:e2e`                                 | Playwright on desktop and phone, against the production build under `wrangler pages dev` with the offline catalogue, including axe accessibility scans. |
| `pnpm lint` · `pnpm typecheck`                  | ESLint and TypeScript project references.                                                                            |
| `pnpm dlx tsx scripts/check-import.ts list.csv` | Dry-run an import against the live catalogue and report what matched.                                                |

## Deploying

Pushes to `main` deploy automatically (`.github/workflows/deploy.yml`): migrations are applied to D1, then the build goes to Cloudflare Pages at `little-alexandria.pages.dev`. The workflow needs two repository secrets, `CLOUDFLARE_API_TOKEN` (Pages and D1 edit) and `CLOUDFLARE_ACCOUNT_ID`. Runtime secrets live on the Pages project:

```bash
wrangler pages secret put GOOGLE_CLIENT_ID --project-name little-alexandria
wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name little-alexandria
wrangler pages secret put GOOGLE_BOOKS_API_KEY --project-name little-alexandria   # optional
```

## Credits

Book data from [Open Library](https://openlibrary.org) and Google Books; adaptations from [Wikidata](https://www.wikidata.org). Covers belong to their publishers. Type: Fraunces, Hanken Grotesk, Gaegu, and IBM Plex Mono.

## License

[MIT](LICENSE). Made by hand, with love for libraries.
