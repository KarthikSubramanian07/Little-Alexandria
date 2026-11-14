import { sha256 } from '@oslojs/crypto/sha2'
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { SESSION_TTL_MS, type Store } from './store'

export const SESSION_COOKIE = 'la_session'
const RENEW_WHEN_LEFT_MS = 1000 * 60 * 60 * 24 * 15

function generateSessionToken(): string {
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  return encodeBase32LowerCaseNoPadding(bytes)
}

/** Only the hash is stored, so a dump of the store can't be replayed as cookies. */
export const sessionIdFor = (token: string) =>
  encodeHexLowerCase(sha256(new TextEncoder().encode(token)))

const isSecure = (c: Context) => new URL(c.req.url).protocol === 'https:'

export async function startSession(c: Context, store: Store, userId: string) {
  const token = generateSessionToken()
  const expiresAt = Date.now() + SESSION_TTL_MS
  await store.putSession(sessionIdFor(token), userId, expiresAt)
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecure(c),
    sameSite: 'Lax',
    path: '/',
    expires: new Date(expiresAt),
  })
}

/** Resolve the signed-in user, sliding the expiry forward for active readers. */
export async function readSession(c: Context, store: Store): Promise<string | null> {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token || !/^[a-z2-7]{32}$/.test(token)) return null
  const id = sessionIdFor(token)
  const session = await store.getSession(id)
  if (!session) return null
  if (session.expiresAt - Date.now() < RENEW_WHEN_LEFT_MS) {
    const expiresAt = Date.now() + SESSION_TTL_MS
    await store.putSession(id, session.userId, expiresAt)
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isSecure(c),
      sameSite: 'Lax',
      path: '/',
      expires: new Date(expiresAt),
    })
  }
  return session.userId
}

export async function endSession(c: Context, store: Store) {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) await store.deleteSession(sessionIdFor(token))
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}
