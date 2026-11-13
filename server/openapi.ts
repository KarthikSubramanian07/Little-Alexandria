// The OpenAPI 3.1 description of the API, served at /openapi.json. Request
// bodies are generated from the same zod schemas the server validates with,
// and a test checks every route in server/app.ts appears here, so the spec
// can't quietly fall behind the code.
import { z } from 'zod'
import {
  addBookSchema,
  goalSchema,
  importBatchSchema,
  profileSchema,
  spineColorSchema,
  updateEntrySchema,
} from '../shared/schemas'
import { SHELVES } from '../shared/types'
import { SITE } from '../shared/site'
import { DEFAULT_POLICY } from './ratelimit'

type Json = Record<string, unknown>

/** A zod schema as a JSON Schema object an OpenAPI 3.1 document can embed. */
function fromZod(schema: z.ZodType): Json {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, {
    io: 'input',
    unrepresentable: 'any',
  })
  return rest
}

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const nullable = (schema: Json) => ({ anyOf: [schema, { type: 'null' }] })
const date = { type: 'string', format: 'date', description: 'A calendar date, YYYY-MM-DD.' }

const schemas: Record<string, Json> = {
  Error: {
    type: 'object',
    description: 'Every error response: a human-readable message.',
    properties: { error: { type: 'string', examples: ['Sign in to continue'] } },
    required: ['error'],
  },
  Shelf: { type: 'string', enum: [...SHELVES], description: 'Which shelf a book is on.' },
  Book: {
    type: 'object',
    description: 'A book in the shared catalogue.',
    properties: {
      id: {
        type: 'string',
        description: 'The catalogue id, "<source>:<sourceId>".',
        examples: ['openlibrary:OL27448W'],
      },
      source: { type: 'string', enum: ['openlibrary', 'google', 'fixture'] },
      sourceId: { type: 'string' },
      title: { type: 'string' },
      subtitle: nullable({ type: 'string' }),
      authors: { type: 'array', items: { type: 'string' } },
      publishedYear: nullable({ type: 'integer' }),
      pageCount: nullable({ type: 'integer' }),
      description: nullable({ type: 'string' }),
      genres: { type: 'array', items: { type: 'string' } },
      coverUrl: nullable({
        type: 'string',
        description: 'A same-origin cover URL under /api/cover.',
      }),
      isbn13: nullable({ type: 'string' }),
      spineColor: nullable({ type: 'string', pattern: '^#[0-9a-f]{6}$' }),
    },
    required: [
      'id',
      'source',
      'sourceId',
      'title',
      'subtitle',
      'authors',
      'publishedYear',
      'pageCount',
      'description',
      'genres',
      'coverUrl',
      'isbn13',
      'spineColor',
    ],
  },
  LibraryEntry: {
    type: 'object',
    description: 'One book on a reader’s shelves, with their rating, dates, and notes.',
    properties: {
      id: { type: 'string' },
      shelf: ref('Shelf'),
      position: {
        type: 'string',
        description: 'Fractional index; entries sort by it bytewise within a shelf.',
      },
      rating: nullable({ type: 'integer', minimum: 1, maximum: 5 }),
      notes: nullable({ type: 'string', description: 'Always null in a shared library.' }),
      startedAt: nullable(date),
      finishedAt: nullable(date),
      finishedApprox: {
        type: 'boolean',
        description: 'True when only the year of finishing is known.',
      },
      createdAt: { type: 'integer', description: 'Milliseconds since the Unix epoch.' },
      updatedAt: { type: 'integer', description: 'Milliseconds since the Unix epoch.' },
      book: ref('Book'),
    },
    required: [
      'id',
      'shelf',
      'position',
      'rating',
      'notes',
      'startedAt',
      'finishedAt',
      'finishedApprox',
      'createdAt',
      'updatedAt',
      'book',
    ],
  },
  User: {
    type: 'object',
    description: 'The signed-in reader.',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      email: nullable({ type: 'string' }),
      avatarUrl: nullable({ type: 'string' }),
      handle: { type: 'string', description: 'Their public address, /u/<handle>.' },
      isPublic: { type: 'boolean', description: 'Whether /u/<handle> is shared.' },
    },
    required: ['id', 'name', 'email', 'avatarUrl', 'handle', 'isPublic'],
  },
  PublicProfile: {
    type: 'object',
    description: 'What anyone can see about a reader who shares their library.',
    properties: {
      name: { type: 'string' },
      handle: { type: 'string' },
      avatarUrl: nullable({ type: 'string' }),
    },
    required: ['name', 'handle', 'avatarUrl'],
  },
  ReadingStats: {
    type: 'object',
    description: 'A year of reading.',
    properties: {
      year: { type: 'integer' },
      booksRead: { type: 'integer' },
      pagesRead: { type: 'integer' },
      goal: nullable({ type: 'integer' }),
      byMonth: {
        type: 'array',
        items: { type: 'integer' },
        minItems: 12,
        maxItems: 12,
        description: 'Books finished per month, January first.',
      },
      topGenres: {
        type: 'array',
        items: {
          type: 'object',
          properties: { genre: { type: 'string' }, count: { type: 'number' } },
          required: ['genre', 'count'],
        },
      },
      averageRating: nullable({ type: 'number' }),
      currentlyReading: { type: 'integer' },
      libraryTotal: { type: 'integer' },
    },
    required: [
      'year',
      'booksRead',
      'pagesRead',
      'goal',
      'byMonth',
      'topGenres',
      'averageRating',
      'currentlyReading',
      'libraryTotal',
    ],
  },
  Goal: {
    type: 'object',
    properties: { year: { type: 'integer' }, target: { type: 'integer' } },
    required: ['year', 'target'],
  },
  SearchResult: {
    type: 'object',
    description: 'A catalogue match, ready to shelve with POST /api/library.',
    properties: {
      source: { type: 'string', enum: ['openlibrary', 'google', 'fixture'] },
      sourceId: { type: 'string' },
      title: { type: 'string' },
      authors: { type: 'array', items: { type: 'string' } },
      publishedYear: nullable({ type: 'integer' }),
      pageCount: nullable({ type: 'integer' }),
      thumbnailUrl: nullable({ type: 'string' }),
    },
    required: [
      'source',
      'sourceId',
      'title',
      'authors',
      'publishedYear',
      'pageCount',
      'thumbnailUrl',
    ],
  },
  RelatedBook: {
    type: 'object',
    description: 'A suggestion, in the same shape as a search result.',
    allOf: [ref('SearchResult')],
  },
  Adaptation: {
    type: 'object',
    description: 'A film or television adaptation, from Wikidata.',
    properties: {
      title: { type: 'string' },
      year: nullable({ type: 'integer' }),
      kind: { type: 'string', enum: ['film', 'series'] },
      url: { type: 'string', description: 'The adaptation’s Wikidata or Wikipedia page.' },
    },
    required: ['title', 'year', 'kind', 'url'],
  },
  ImportOutcome: {
    type: 'object',
    description: 'What happened to one imported row.',
    properties: {
      status: { type: 'string', enum: ['added', 'exists', 'unmatched', 'retry'] },
      title: { type: 'string' },
      author: nullable({ type: 'string' }),
      entry: ref('LibraryEntry'),
    },
    required: ['status', 'title'],
  },
  AddBook: fromZod(addBookSchema),
  UpdateEntry: { ...fromZod(updateEntrySchema), minProperties: 1 },
  SetGoal: fromZod(goalSchema),
  SetSpineColor: fromZod(spineColorSchema),
  UpdateProfile: { ...fromZod(profileSchema), minProperties: 1 },
  ImportBatch: fromZod(importBatchSchema),
}

const json = (schema: Json, description: string, headers: Record<string, Json> = RATE_HEADERS) => ({
  description,
  headers,
  content: { 'application/json': { schema } },
})

const rateHeader = (description: string) => ({ description, schema: { type: 'string' } })
const RATE_HEADERS: Record<string, Json> = {
  'RateLimit-Policy': rateHeader('The quota and window, e.g. "default";q=600;w=60.'),
  RateLimit: rateHeader('Requests remaining and seconds until reset, e.g. "default";r=598;t=42.'),
  'RateLimit-Limit': rateHeader('Requests allowed per window.'),
  'RateLimit-Remaining': rateHeader('Requests left in this window.'),
  'RateLimit-Reset': rateHeader('Seconds until the window resets.'),
}

const errors = (...codes: number[]) =>
  Object.fromEntries(
    codes.map((code) => [
      String(code),
      code === 429
        ? json(ref('Error'), ERROR_TEXT[code]!, {
            ...RATE_HEADERS,
            'Retry-After': rateHeader('Seconds to wait before trying again.'),
          })
        : json(ref('Error'), ERROR_TEXT[code]!),
    ]),
  )

const ERROR_TEXT: Record<number, string> = {
  400: 'The request was malformed or failed validation.',
  401: 'Not signed in.',
  403: 'A write came from another origin.',
  404: 'Not found.',
  409: 'Conflicts with what is already there.',
  429: 'Rate limited. Wait for Retry-After seconds.',
  503: 'The book catalogue is busy. Try again shortly.',
}

const READER = [{ session: [] }]
const pathParam = (name: string, description: string, schema: Json = { type: 'string' }) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema,
})
const entryId = pathParam('id', 'The library entry id, from GET /api/library.')
const body = (name: string) => ({
  required: true,
  content: { 'application/json': { schema: ref(name) } },
})
const noContent = { description: 'Done; nothing to return.', headers: RATE_HEADERS }
const redirect = (description: string) => ({
  description,
  headers: { Location: { description: 'Where to go next.', schema: { type: 'string' } } },
})

const paths: Record<string, Record<string, Json>> = {
  '/api/auth/providers': {
    get: {
      operationId: 'getSignInProviders',
      tags: ['Auth'],
      summary: 'List the sign-in methods',
      description: 'Which sign-in methods this deployment has switched on.',
      security: [],
      responses: {
        200: json(
          {
            type: 'object',
            properties: { google: { type: 'boolean' }, guest: { type: 'boolean' } },
            required: ['google', 'guest'],
          },
          'The available methods.',
        ),
        ...errors(429),
      },
    },
  },
  '/api/auth/google': {
    get: {
      operationId: 'startGoogleSignIn',
      tags: ['Auth'],
      summary: 'Start Google sign-in',
      description: 'Redirects a browser to Google. Meant for people, not scripts.',
      security: [],
      parameters: [
        {
          name: 'next',
          in: 'query',
          required: false,
          description: 'A same-site path to return to after signing in.',
          schema: { type: 'string', examples: ['/library'] },
        },
      ],
      responses: { 302: redirect('To Google’s sign-in page.') },
    },
  },
  '/api/auth/google/callback': {
    get: {
      operationId: 'finishGoogleSignIn',
      tags: ['Auth'],
      summary: 'Finish Google sign-in',
      description:
        'Google sends the browser here. Sets the la_session cookie and redirects into the app.',
      security: [],
      parameters: [
        {
          name: 'code',
          in: 'query',
          required: true,
          description: 'Google’s authorization code.',
          schema: { type: 'string' },
        },
        {
          name: 'state',
          in: 'query',
          required: true,
          description: 'The anti-forgery state.',
          schema: { type: 'string' },
        },
      ],
      responses: { 302: redirect('Into the app, or back home with an error.') },
    },
  },
  '/api/auth/guest': {
    post: {
      operationId: 'signInAsGuest',
      tags: ['Auth'],
      summary: 'Sign in as a guest (local development only)',
      description: 'A throwaway reader for exploring the app locally. Answers 404 in production.',
      security: [],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { key: { type: 'string', pattern: '^[\\w-]{1,40}$' } },
            },
          },
        },
      },
      responses: {
        200: json(
          { type: 'object', properties: { user: ref('User') }, required: ['user'] },
          'Signed in.',
        ),
        ...errors(403, 404, 429),
      },
    },
  },
  '/api/auth/logout': {
    post: {
      operationId: 'signOut',
      tags: ['Auth'],
      summary: 'Sign out',
      description: 'Ends the current session and clears its cookie.',
      security: [],
      responses: { 204: noContent, ...errors(403, 429) },
    },
  },
  '/api/auth/me': {
    get: {
      operationId: 'getCurrentReader',
      tags: ['Auth'],
      summary: 'Who is signed in',
      description: 'The signed-in reader, or null when signed out.',
      security: [],
      responses: {
        200: json(
          { type: 'object', properties: { user: nullable(ref('User')) }, required: ['user'] },
          'The reader, or null.',
        ),
        ...errors(429),
      },
    },
  },
  '/api/cover': {
    get: {
      operationId: 'getCover',
      tags: ['Public'],
      summary: 'Fetch a book cover',
      description:
        'Proxies a cover from Open Library or Google Books through this origin. Other hosts are refused.',
      security: [],
      parameters: [
        {
          name: 'src',
          in: 'query',
          required: true,
          description: 'The cover’s https URL on covers.openlibrary.org or books.google.com.',
          schema: { type: 'string', format: 'uri' },
        },
      ],
      responses: {
        200: {
          description: 'The cover image.',
          content: { 'image/*': { schema: { type: 'string', contentMediaType: 'image/*' } } },
        },
        400: {
          description: 'Bad or disallowed cover URL.',
          content: { 'application/json': { schema: ref('Error') } },
        },
        404: { description: 'The book has no cover.' },
      },
    },
  },
  '/api/u/{handle}': {
    get: {
      operationId: 'getSharedLibrary',
      tags: ['Public'],
      summary: 'Read a shared library',
      description:
        'A reader’s public profile, books, and reading stats for this year. Notes are always omitted. 404 unless the reader has turned sharing on.',
      security: [],
      parameters: [
        pathParam('handle', 'The reader’s public handle, as in /u/<handle>.', {
          type: 'string',
          pattern: '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$',
        }),
      ],
      responses: {
        200: json(
          {
            type: 'object',
            properties: {
              profile: ref('PublicProfile'),
              entries: { type: 'array', items: ref('LibraryEntry') },
              stats: ref('ReadingStats'),
            },
            required: ['profile', 'entries', 'stats'],
          },
          'The shared library.',
        ),
        ...errors(404, 429),
      },
    },
  },
  '/api/search': {
    get: {
      operationId: 'searchBooks',
      tags: ['Library'],
      summary: 'Search the catalogue',
      description:
        'Searches Open Library (or Google Books, when configured) by title, author, or ISBN.',
      security: READER,
      parameters: [
        {
          name: 'q',
          in: 'query',
          required: true,
          description: 'What to search for. Fewer than two characters returns nothing.',
          schema: { type: 'string', maxLength: 120 },
        },
      ],
      responses: {
        200: json(
          {
            type: 'object',
            properties: { results: { type: 'array', items: ref('SearchResult') } },
            required: ['results'],
          },
          'Matching books.',
        ),
        ...errors(401, 429, 503),
      },
    },
  },
  '/api/library': {
    get: {
      operationId: 'listLibrary',
      tags: ['Library'],
      summary: 'List your shelves',
      description: 'Every book on the reader’s shelves, with their reading goals.',
      security: READER,
      responses: {
        200: json(
          {
            type: 'object',
            properties: {
              entries: { type: 'array', items: ref('LibraryEntry') },
              goals: {
                type: 'object',
                description: 'Reading goals by year, e.g. {"2026": 24}.',
                propertyNames: { pattern: '^\\d{4}$' },
                additionalProperties: { type: 'integer' },
              },
            },
            required: ['entries', 'goals'],
          },
          'The library.',
        ),
        ...errors(401, 429),
      },
    },
    post: {
      operationId: 'addBook',
      tags: ['Library'],
      summary: 'Shelve a book',
      description:
        'Adds a book from a search result. Moving it to Reading or Read stamps today’s date.',
      security: READER,
      requestBody: body('AddBook'),
      responses: {
        201: json(
          { type: 'object', properties: { entry: ref('LibraryEntry') }, required: ['entry'] },
          'Shelved.',
        ),
        ...errors(400, 401, 403, 404, 409, 429, 503),
      },
    },
  },
  '/api/library/{id}': {
    patch: {
      operationId: 'updateEntry',
      tags: ['Library'],
      summary: 'Update a book on your shelves',
      description:
        'Move, reorder, rate, date, or annotate a book. Send only the fields to change. Changing shelf without a position puts the book at the front.',
      security: READER,
      parameters: [entryId],
      requestBody: body('UpdateEntry'),
      responses: {
        200: json(
          { type: 'object', properties: { entry: ref('LibraryEntry') }, required: ['entry'] },
          'Updated.',
        ),
        ...errors(400, 401, 403, 404, 429),
      },
    },
    delete: {
      operationId: 'removeEntry',
      tags: ['Library'],
      summary: 'Take a book off your shelves',
      description: 'Removes the book, its rating, dates, and notes.',
      security: READER,
      parameters: [entryId],
      responses: { 204: noContent, ...errors(401, 403, 404, 429) },
    },
  },
  '/api/library/{id}/spine': {
    put: {
      operationId: 'setSpineColor',
      tags: ['Library'],
      summary: 'Save a book’s spine colour',
      description: 'The colour sampled from the cover. Only saved the first time.',
      security: READER,
      parameters: [entryId],
      requestBody: body('SetSpineColor'),
      responses: { 204: noContent, ...errors(400, 401, 403, 404, 429) },
    },
  },
  '/api/library/{id}/related': {
    get: {
      operationId: 'getRelatedBooks',
      tags: ['Discover'],
      summary: 'More like this book',
      description:
        'The book’s description, more by its author, similar books, and film or TV adaptations.',
      security: READER,
      parameters: [entryId],
      responses: {
        200: json(
          {
            type: 'object',
            properties: {
              description: nullable({ type: 'string' }),
              byAuthor: { type: 'array', items: ref('RelatedBook') },
              similar: { type: 'array', items: ref('RelatedBook') },
              adaptations: { type: 'array', items: ref('Adaptation') },
            },
            required: ['description', 'byAuthor', 'similar', 'adaptations'],
          },
          'Related books.',
        ),
        ...errors(401, 404, 429, 503),
      },
    },
  },
  '/api/goals/{year}': {
    put: {
      operationId: 'setReadingGoal',
      tags: ['Library'],
      summary: 'Set a yearly reading goal',
      description: 'How many books the reader means to finish in a year.',
      security: READER,
      parameters: [
        pathParam('year', 'The year, e.g. 2026.', {
          type: 'integer',
          minimum: 1900,
          maximum: 3000,
        }),
      ],
      requestBody: body('SetGoal'),
      responses: { 200: json(ref('Goal'), 'The goal.'), ...errors(400, 401, 403, 429) },
    },
  },
  '/api/stats': {
    get: {
      operationId: 'getReadingStats',
      tags: ['Library'],
      summary: 'Reading stats for a year',
      description: 'Books and pages read, by month and genre, against the year’s goal.',
      security: READER,
      parameters: [
        {
          name: 'year',
          in: 'query',
          required: false,
          description: 'Defaults to the current year.',
          schema: { type: 'integer', minimum: 1900, maximum: 3000 },
        },
      ],
      responses: { 200: json(ref('ReadingStats'), 'The stats.'), ...errors(400, 401, 429) },
    },
  },
  '/api/discover': {
    get: {
      operationId: 'getRecommendations',
      tags: ['Discover'],
      summary: 'Recommendations for you',
      description: 'Shelves of suggestions drawn from the reader’s favourite authors and genres.',
      security: READER,
      responses: {
        200: json(
          {
            type: 'object',
            properties: {
              sections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', examples: ['Because you loved Ursula K. Le Guin'] },
                    books: { type: 'array', items: ref('RelatedBook') },
                  },
                  required: ['title', 'books'],
                },
              },
            },
            required: ['sections'],
          },
          'Recommendations.',
        ),
        ...errors(401, 429, 503),
      },
    },
  },
  '/api/import': {
    post: {
      operationId: 'importReadingList',
      tags: ['Library'],
      summary: 'Import part of a reading list',
      description:
        'Matches up to six rows against the catalogue and shelves them. Send batches one after another; rows marked "retry" should be sent again later.',
      security: READER,
      requestBody: body('ImportBatch'),
      responses: {
        200: json(
          {
            type: 'object',
            properties: { outcomes: { type: 'array', items: ref('ImportOutcome') } },
            required: ['outcomes'],
          },
          'What happened to each row.',
        ),
        ...errors(400, 401, 403, 429),
      },
    },
  },
  '/api/export': {
    get: {
      operationId: 'exportLibrary',
      tags: ['Library'],
      summary: 'Download your library as CSV',
      description: 'A Goodreads-compatible CSV of every book, rating, date, and note.',
      security: READER,
      responses: {
        200: {
          description: 'The CSV file.',
          headers: RATE_HEADERS,
          content: { 'text/csv': { schema: { type: 'string' } } },
        },
        ...errors(401, 429),
      },
    },
  },
  '/api/me': {
    patch: {
      operationId: 'updateProfile',
      tags: ['Account'],
      summary: 'Change your handle or sharing',
      description: 'Pick a new /u/<handle>, or turn public sharing on or off.',
      security: READER,
      requestBody: body('UpdateProfile'),
      responses: {
        200: json(
          { type: 'object', properties: { user: ref('User') }, required: ['user'] },
          'The updated reader.',
        ),
        ...errors(400, 401, 403, 409, 429),
      },
    },
    delete: {
      operationId: 'deleteAccount',
      tags: ['Account'],
      summary: 'Delete your account',
      description: 'Permanently deletes the reader, their sessions, shelves, notes, and goals.',
      security: READER,
      responses: { 204: noContent, ...errors(401, 403, 429) },
    },
  },
}

export function openApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Little Alexandria API',
      version: '1.0.0',
      summary: 'Read shared bookshelves and manage your own.',
      description: [
        'The JSON API behind Little Alexandria, a hand-drawn bookshelf and reading tracker.',
        'Shared libraries are public. Reader endpoints act on the signed-in reader, through the la_session cookie that Google sign-in sets; writes must also send a matching Origin header.',
        `Rate limited to ${DEFAULT_POLICY.quota} requests per ${DEFAULT_POLICY.window} seconds per client, announced in RateLimit headers.`,
        `Human docs: ${SITE.origin}/docs. Agent guide: ${SITE.origin}/llms.txt.`,
      ].join('\n\n'),
      license: { name: 'MIT', identifier: 'MIT' },
      contact: { name: 'Little Alexandria on GitHub', url: SITE.issues },
    },
    externalDocs: { description: 'Little Alexandria API docs', url: `${SITE.origin}/docs` },
    servers: [{ url: SITE.origin, description: 'Production' }],
    tags: [
      { name: 'Public', description: 'No sign-in needed.' },
      { name: 'Auth', description: 'Signing in and out.' },
      { name: 'Library', description: 'The signed-in reader’s shelves.' },
      { name: 'Discover', description: 'Suggestions and related books.' },
      { name: 'Account', description: 'The reader’s profile and account.' },
    ],
    security: READER,
    paths,
    components: {
      schemas,
      securitySchemes: {
        session: {
          type: 'apiKey',
          in: 'cookie',
          name: 'la_session',
          description:
            'Set by Google sign-in at /api/auth/google. Writes also need an Origin header matching the site.',
        },
      },
    },
  }
}
