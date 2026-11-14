import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { RateLimiter, clientKey, ipv6Prefix64, rateLimit, rateLimitHeaders } from './ratelimit'

const policy = { name: 'default', quota: 3, window: 60 }

describe('RateLimiter', () => {
  it('allows the quota, refuses the next, and resets with the window', () => {
    let now = 1_000_000
    const limiter = new RateLimiter(policy, () => now)
    expect([1, 2, 3].map(() => limiter.hit('a').allowed)).toEqual([true, true, true])
    const refused = limiter.hit('a')
    expect(refused).toEqual({ allowed: false, remaining: 0, reset: 60 })
    // Other clients have their own count.
    expect(limiter.hit('b')).toEqual({ allowed: true, remaining: 2, reset: 60 })
    now += 45_000
    expect(limiter.hit('a').reset).toBe(15)
    now += 15_000
    expect(limiter.hit('a')).toEqual({ allowed: true, remaining: 2, reset: 60 })
  })
})

describe('rateLimitHeaders', () => {
  it('speaks both the current and the earlier IETF drafts', () => {
    expect(rateLimitHeaders(policy, { remaining: 2, reset: 42 })).toEqual({
      'RateLimit-Policy': '"default";q=3;w=60',
      RateLimit: '"default";r=2;t=42',
      'RateLimit-Limit': '3',
      'RateLimit-Remaining': '2',
      'RateLimit-Reset': '42',
    })
  })
})

describe('clientKey', () => {
  it('prefers Cloudflare’s client address', () => {
    expect(
      clientKey(new Headers({ 'CF-Connecting-IP': '1.2.3.4', 'X-Forwarded-For': '5.6.7.8' })),
    ).toBe('1.2.3.4')
    expect(clientKey(new Headers({ 'X-Forwarded-For': '5.6.7.8, 9.9.9.9' }))).toBe('5.6.7.8')
    expect(clientKey(new Headers())).toBe('local')
  })
})

describe('rateLimit middleware', () => {
  const app = new Hono()
  app.use('*', rateLimit(new RateLimiter(policy)))
  app.get('/', (c) => c.json({ ok: true }))
  const call = () => app.request('/', { headers: { 'CF-Connecting-IP': '7.7.7.7' } })

  it('labels every response, then answers 429 with Retry-After', async () => {
    const first = await call()
    expect(first.status).toBe(200)
    expect(first.headers.get('RateLimit')).toMatch(/^"default";r=2;t=\d+$/)
    expect(first.headers.get('RateLimit-Policy')).toBe('"default";q=3;w=60')
    await call()
    await call()
    const limited = await call()
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(limited.headers.get('RateLimit-Remaining')).toBe('0')
    expect(await limited.json()).toEqual({ error: 'Too many requests. Please slow down.' })
  })
})

describe('ipv6Prefix64', () => {
  it('counts a whole /64 as one client', () => {
    expect(ipv6Prefix64('2001:db8:abcd:12:1:2:3:4')).toBe('2001:db8:abcd:12::/64')
    expect(ipv6Prefix64('2001:db8:abcd:12::99')).toBe('2001:db8:abcd:12::/64')
    expect(ipv6Prefix64('2001:DB8::1')).toBe('2001:db8:0:0::/64')
    expect(ipv6Prefix64('::1')).toBe('0:0:0:0::/64')
    const headers = (ip: string) => new Headers({ 'CF-Connecting-IP': ip })
    expect(clientKey(headers('2001:db8:abcd:12::1'))).toBe(
      clientKey(headers('2001:db8:abcd:12:ffff::2')),
    )
    expect(clientKey(headers('203.0.113.9'))).toBe('203.0.113.9')
  })
})
