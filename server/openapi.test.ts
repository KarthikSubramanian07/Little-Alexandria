import { Validator } from '@seriousme/openapi-schema-validator'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app } from './app'
import type { Env } from './env'
import { openApiDocument } from './openapi'
import { testDatabase } from './test/d1'

const doc = openApiDocument()
type Operation = {
  operationId: string
  summary: string
  description: string
  parameters?: { name: string; in: string }[]
  responses: Record<string, { content?: Record<string, unknown> }>
}
const operations = Object.entries(doc.paths).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, operation]) => ({
    path,
    method,
    operation: operation as Operation,
  })),
)

describe('the OpenAPI document', () => {
  it('is a valid OpenAPI 3.1 document', async () => {
    const result = await new Validator().validate(structuredClone(doc))
    expect(result.errors ?? []).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('describes exactly the routes the API serves', () => {
    const served = new Set(
      app.routes
        .filter((route) => route.method !== 'ALL')
        .map((route) => `${route.method.toLowerCase()} ${route.path.replace(/:(\w+)/g, '{$1}')}`),
    )
    const documented = new Set(operations.map(({ method, path }) => `${method} ${path}`))
    expect([...documented].sort()).toEqual([...served].sort())
  })

  it('gives every operation a unique id, a summary, a description, and its path parameters', () => {
    const ids = operations.map(({ operation }) => operation.operationId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const { path, operation } of operations) {
      expect(operation.operationId).toMatch(/^[a-z][A-Za-z]+$/)
      expect(operation.summary.length).toBeGreaterThan(5)
      expect(operation.description.length).toBeGreaterThan(20)
      const declared = (operation.parameters ?? [])
        .filter((p) => p.in === 'path')
        .map((p) => p.name)
      const inPath = [...path.matchAll(/\{(\w+)\}/g)].map((match) => match[1])
      expect(declared.sort()).toEqual(inPath.sort())
    }
  })
})

describe('real responses match the documented schemas', () => {
  let database: Awaited<ReturnType<typeof testDatabase>>
  const env = (): Env => ({ DB: database.db, DEV_LOGIN: '1', BOOK_SOURCE: 'fixture' })
  const ajv = new Ajv2020({ strict: false, validateFormats: false, allErrors: true })
  ajv.addSchema({ ...doc, $id: 'https://openapi.test/doc' })
  const pointer = (...parts: string[]) =>
    parts.map((part) => part.replace(/~/g, '~0').replace(/\//g, '~1')).join('/')

  let cookie = ''
  const call = async (method: string, path: string, body?: unknown) => {
    const headers = new Headers({ 'CF-Connecting-IP': '10.9.9.9' })
    if (cookie) headers.set('Cookie', cookie)
    if (method !== 'GET') headers.set('Origin', 'http://localhost')
    if (body) headers.set('Content-Type', 'application/json')
    const response = await app.request(
      `http://localhost${path}`,
      { method, headers, body: body ? JSON.stringify(body) : undefined },
      env(),
    )
    const set = response.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0]!
    return response
  }

  /** Call the API and check the body against the spec's schema for that path, method, and status. */
  const conforms = async (
    method: string,
    path: string,
    template: string,
    body?: unknown,
    status = 200,
  ) => {
    const response = await call(method, path, body)
    expect(response.status).toBe(status)
    expect(response.headers.get('RateLimit-Policy')).toBe('"default";q=600;w=60')
    const validate = ajv.compile({
      $ref: `https://openapi.test/doc#/${pointer('paths', template, method.toLowerCase(), 'responses', String(status), 'content', 'application/json', 'schema')}`,
    })
    const json = await response.json()
    const valid = validate(json)
    expect(validate.errors ?? [], `${method} ${path}`).toEqual([])
    expect(valid).toBe(true)
    return json as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  beforeAll(async () => {
    database = await testDatabase()
  })
  afterAll(() => database.dispose())

  it('covers a reader’s whole journey', async () => {
    await conforms('GET', '/api/auth/providers', '/api/auth/providers')
    await conforms('GET', '/api/auth/me', '/api/auth/me')
    await conforms('GET', '/api/library', '/api/library', undefined, 401)
    await conforms('POST', '/api/auth/guest', '/api/auth/guest', { key: 'spec' })
    await conforms('GET', '/api/auth/me', '/api/auth/me')
    const { results } = await conforms('GET', '/api/search?q=earthsea', '/api/search')
    const added = await conforms(
      'POST',
      '/api/library',
      '/api/library',
      {
        source: results[0].source,
        sourceId: results[0].sourceId,
        shelf: 'read',
        today: '2026-11-13',
      },
      201,
    )
    const id = added.entry.id as string
    await conforms('PATCH', `/api/library/${id}`, '/api/library/{id}', { rating: 5 })
    await conforms('GET', '/api/library', '/api/library')
    await conforms('GET', `/api/library/${id}/related`, '/api/library/{id}/related')
    await conforms('PUT', '/api/goals/2026', '/api/goals/{year}', { target: 24 })
    await conforms('GET', '/api/stats?year=2026', '/api/stats')
    await conforms('GET', '/api/discover', '/api/discover')
    await conforms('POST', '/api/import', '/api/import', {
      today: '2026-11-13',
      rows: [
        {
          title: 'Piranesi',
          author: 'Susanna Clarke',
          isbn: null,
          shelf: 'want_to_read',
          rating: null,
          finishedAt: null,
          finishedYear: null,
          notes: null,
          genreHint: null,
        },
      ],
    })
    const { user } = await conforms('PATCH', '/api/me', '/api/me', { isPublic: true })
    await conforms('GET', `/api/u/${user.handle}`, '/api/u/{handle}')
    await conforms('GET', '/api/u/nobody-here', '/api/u/{handle}', undefined, 404)
  })
})
