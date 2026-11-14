import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CONTENT_SECURITY_POLICY, SECURITY_HEADERS, withSecurityHeaders } from './headers'

describe('security headers', () => {
  it('match what public/_headers sends with static files', () => {
    const file = readFileSync('public/_headers', 'utf8')
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(file, name).toContain(`  ${name}: ${value}\n`)
    }
  })

  it('forbid framing and plugins', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'")
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'")
  })

  it('fill in what a response lacks and keep what it set', async () => {
    const response = withSecurityHeaders(
      new Response('hi', {
        status: 201,
        headers: { 'Content-Security-Policy': "default-src 'none'; sandbox" },
      }),
    )
    expect(response.status).toBe(201)
    expect(await response.text()).toBe('hi')
    expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'none'; sandbox")
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('work on redirects, whose headers are otherwise read-only', () => {
    const response = withSecurityHeaders(Response.redirect('https://example.com/a', 308))
    expect(response.headers.get('Location')).toBe('https://example.com/a')
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })
})
