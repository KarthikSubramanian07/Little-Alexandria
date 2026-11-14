// A fixed-window rate limit, announced with the IETF RateLimit header fields
// (draft-ietf-httpapi-ratelimit-headers) so clients and agents can pace
// themselves instead of guessing. Counts live in the isolate's memory: cheap,
// no database writes, and honest about being per server instance.
import type { MiddlewareHandler } from 'hono'

interface RateLimitPolicy {
  /** Name used in the RateLimit-Policy header. */
  name: string
  /** Requests allowed per window. */
  quota: number
  /** Window length in seconds. */
  window: number
}

export const DEFAULT_POLICY: RateLimitPolicy = { name: 'default', quota: 600, window: 60 }
/** Each import batch looks up several books upstream, so imports get a smaller budget. */
export const IMPORT_POLICY: RateLimitPolicy = { name: 'import', quota: 60, window: 60 }
/** Covers: enough for a big library on a cold cache, not enough to use us as a free proxy. */
export const COVER_POLICY: RateLimitPolicy = { name: 'cover', quota: 1200, window: 60 }
/** Server-rendered pages outside the API, such as shared libraries and the sitemap. */
export const PAGE_POLICY: RateLimitPolicy = { name: 'page', quota: 300, window: 60 }

interface Bucket {
  start: number
  count: number
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>()

  constructor(
    readonly policy: RateLimitPolicy,
    private now: () => number = Date.now,
  ) {}

  /** Count one request for `key`, and say whether it may go ahead. */
  hit(key: string) {
    const now = this.now()
    const windowMs = this.policy.window * 1000
    let bucket = this.buckets.get(key)
    if (!bucket || now - bucket.start >= windowMs) {
      bucket = { start: now, count: 0 }
      this.buckets.set(key, bucket)
      if (this.buckets.size > 10_000) this.sweep(now)
    }
    bucket.count += 1
    const reset = Math.max(1, Math.ceil((bucket.start + windowMs - now) / 1000))
    return {
      allowed: bucket.count <= this.policy.quota,
      remaining: Math.max(0, this.policy.quota - bucket.count),
      reset,
    }
  }

  private sweep(now: number) {
    const windowMs = this.policy.window * 1000
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.start >= windowMs) this.buckets.delete(key)
    }
  }
}

/** The response headers for one request's standing. */
export function rateLimitHeaders(
  policy: RateLimitPolicy,
  standing: { remaining: number; reset: number },
): Record<string, string> {
  return {
    'RateLimit-Policy': `"${policy.name}";q=${policy.quota};w=${policy.window}`,
    RateLimit: `"${policy.name}";r=${standing.remaining};t=${standing.reset}`,
    // The earlier draft's fields, which many clients still read.
    'RateLimit-Limit': String(policy.quota),
    'RateLimit-Remaining': String(standing.remaining),
    'RateLimit-Reset': String(standing.reset),
  }
}

/**
 * Who is asking: Cloudflare's view of the client's address. An IPv6 client
 * usually owns a whole /64, so that is the unit that gets counted.
 */
export function clientKey(headers: Headers): string {
  const ip =
    headers.get('CF-Connecting-IP') ??
    headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'local'
  return ip.includes(':') ? ipv6Prefix64(ip) : ip
}

/** The first four groups of an IPv6 address, with `::` expanded. */
export function ipv6Prefix64(ip: string): string {
  const [head = '', tail] = ip.toLowerCase().split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups =
    tail === undefined
      ? left
      : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, '') || '0')
    .join(':')}::/64`
}

/** Hono middleware: count the request, label the response, refuse with 429 past the quota. */
export function rateLimit(limiter: RateLimiter): MiddlewareHandler {
  return async (c, next) => {
    const standing = limiter.hit(clientKey(c.req.raw.headers))
    const headers = rateLimitHeaders(limiter.policy, standing)
    if (!standing.allowed) {
      return c.json({ error: 'Too many requests. Please slow down.' }, 429, {
        ...headers,
        'Retry-After': String(standing.reset),
      })
    }
    await next()
    for (const [name, value] of Object.entries(headers)) c.res.headers.set(name, value)
  }
}
