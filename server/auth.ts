import { Google, decodeIdToken, generateCodeVerifier, generateState } from 'arctic'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { AppEnv } from './env'
import { endSession, readSession, startSession } from './session'
import { createStore } from './store'

const STATE_COOKIE = 'la_oauth_state'
const VERIFIER_COOKIE = 'la_oauth_verifier'
const NEXT_COOKIE = 'la_oauth_next'

const googleFor = (env: AppEnv['Bindings'], origin: string) =>
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? new Google(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        `${origin}/api/auth/google/callback`,
      )
    : null

/** Only same-site paths, so the sign-in flow can't be turned into an open redirect. */
const safeNext = (value: string | undefined) =>
  value && value.startsWith('/') && !value.startsWith('//') ? value : '/library'

interface GoogleClaims {
  sub: string
  name?: string
  given_name?: string
  email?: string
  picture?: string
}

export const auth = new Hono<AppEnv>()
  .get('/providers', (c) =>
    c.json({
      google: Boolean(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET),
      guest: c.env.DEV_LOGIN === '1',
    }),
  )

  .get('/google', (c) => {
    const url = new URL(c.req.url)
    const google = googleFor(c.env, url.origin)
    if (!google) return c.redirect('/?error=google_unconfigured')
    const state = generateState()
    const verifier = generateCodeVerifier()
    const authorization = google.createAuthorizationURL(state, verifier, [
      'openid',
      'profile',
      'email',
    ])
    authorization.searchParams.set('prompt', 'select_account')
    const cookie = {
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'Lax' as const,
      path: '/',
      maxAge: 600,
    }
    setCookie(c, STATE_COOKIE, state, cookie)
    setCookie(c, VERIFIER_COOKIE, verifier, cookie)
    setCookie(c, NEXT_COOKIE, safeNext(c.req.query('next')), cookie)
    return c.redirect(authorization.toString())
  })

  .get('/google/callback', async (c) => {
    const url = new URL(c.req.url)
    const google = googleFor(c.env, url.origin)
    const state = c.req.query('state')
    const code = c.req.query('code')
    const expectedState = getCookie(c, STATE_COOKIE)
    const verifier = getCookie(c, VERIFIER_COOKIE)
    const next = safeNext(getCookie(c, NEXT_COOKIE))
    for (const name of [STATE_COOKIE, VERIFIER_COOKIE, NEXT_COOKIE])
      deleteCookie(c, name, { path: '/' })

    if (!google || !state || !code || !verifier || state !== expectedState) {
      return c.redirect('/?error=sign_in_failed')
    }
    let claims: GoogleClaims
    try {
      const tokens = await google.validateAuthorizationCode(code, verifier)
      claims = decodeIdToken(tokens.idToken()) as GoogleClaims
    } catch (error) {
      console.warn('google token exchange failed', error)
      return c.redirect('/?error=sign_in_failed')
    }

    const store = createStore(c.env.DB)
    const user = await store.upsertUser(`google:${claims.sub}`, {
      name: claims.name ?? claims.given_name ?? 'Reader',
      email: claims.email ?? null,
      avatarUrl: claims.picture ?? null,
    })
    await startSession(c, store, user.id)
    return c.redirect(next)
  })

  // Local development only: a one-click guest reader, so the app can be explored
  // (and tested end to end) without Google credentials.
  .post('/guest', async (c) => {
    if (c.env.DEV_LOGIN !== '1') return c.json({ error: 'Not available' }, 404)
    const store = createStore(c.env.DB)
    const user = await store.upsertUser('guest', {
      name: 'Guest Reader',
      email: null,
      avatarUrl: null,
    })
    await startSession(c, store, user.id)
    return c.json({ user })
  })

  .post('/logout', async (c) => {
    await endSession(c, createStore(c.env.DB))
    return c.body(null, 204)
  })

  .get('/me', async (c) => {
    const store = createStore(c.env.DB)
    const userId = await readSession(c, store)
    const user = userId ? await store.getUser(userId) : null
    return c.json({ user })
  })
