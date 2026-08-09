import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

/**
 * Proving that @someone is @someone.
 *
 * The whole product hinges on this one question. Claiming a sheet is what turns
 * a crawled row into a page its subject consented to — it is the moment the
 * sheet becomes indexable, shareable and removable by the person it describes.
 * Until this file existed, `CONSENT_ACTIONS_ENABLED` was false and every one of
 * those things was switched off: 142 sheets, none claimed, a sitemap holding
 * three URLs.
 *
 * The verification is free and exact, because the handles here ARE X handles.
 * One OAuth round trip and X tells us the username of whoever just logged in.
 * No email, no support queue, no honour system.
 *
 * The rule the rest of the code depends on: the handle acted upon comes from
 * the access token and NEVER from the request. A body-supplied handle is what
 * made the old opt-out endpoint "anyone can remove anyone".
 */

const AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize'
const TOKEN_URL = 'https://api.x.com/2/oauth2/token'
const ME_URL = 'https://api.x.com/2/users/me'

/** X rejects the request without tweet.read, even though we only read a name. */
const SCOPES = 'users.read tweet.read'

const SESSION_COOKIE = 'ic_session'
const FLOW_COOKIE = 'ic_oauth'
/** Long enough to claim and change your mind, short enough not to be a liability. */
const SESSION_MAX_AGE = 60 * 60 * 12
const FLOW_MAX_AGE = 60 * 10

export interface XCredentials {
  clientId: string
  clientSecret: string
}

/**
 * Null until an X app is registered and its credentials are set.
 *
 * Everything downstream keys off this rather than off a hardcoded flag, so the
 * sign-in button, the claim route and the removal route all appear together the
 * moment the credentials land — and all stay absent, at the route and not only
 * in the interface, until then.
 */
export function xCredentials(): XCredentials | null {
  const clientId = process.env.X_CLIENT_ID
  const clientSecret = process.env.X_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

/**
 * The site's own origin, which the OAuth redirect_uri must match exactly.
 *
 * X compares this string against the callback registered on the app, character
 * for character. Deriving it from the request would let a Host header pick the
 * redirect target, which is how open redirects happen.
 */
export function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

export function redirectUri(): string {
  return `${siteOrigin()}/api/auth/x/callback`
}

function secret(): string {
  // AUTH_SECRET when it exists; CRON_SECRET is the documented fallback so this
  // works without provisioning a second value. Neither may ever be absent in
  // production, hence the throw rather than a default string: an unsigned
  // session cookie is a login bypass, not a degraded experience.
  const value = process.env.AUTH_SECRET ?? process.env.CRON_SECRET
  if (!value) throw new Error('AUTH_SECRET (or CRON_SECRET) is not set')
  return value
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

/** Constant-time, because a fast string compare on a MAC leaks it a byte at a time. */
function verify(payload: string, signature: string): boolean {
  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(signature)
  if (expected.length !== given.length) return false
  return timingSafeEqual(expected, given)
}

// ---------------------------------------------------------------------------
// The flow: PKCE + state, both stored in one short-lived httpOnly cookie
// ---------------------------------------------------------------------------

export interface FlowState {
  verifier: string
  state: string
  /** Where to send them back to once they are known. */
  next: string
}

export function newFlow(next: string): FlowState {
  return {
    verifier: randomBytes(32).toString('base64url'),
    state: randomBytes(16).toString('base64url'),
    next,
  }
}

export function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function authorizeUrl(credentials: XCredentials, flow: FlowState): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: credentials.clientId,
    redirect_uri: redirectUri(),
    scope: SCOPES,
    state: flow.state,
    code_challenge: challengeFor(flow.verifier),
    code_challenge_method: 'S256',
  })
  return `${AUTHORIZE_URL}?${params}`
}

export async function setFlowCookie(flow: FlowState): Promise<void> {
  const store = await cookies()
  const payload = Buffer.from(JSON.stringify(flow)).toString('base64url')
  store.set(FLOW_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: siteOrigin().startsWith('https'),
    // `lax` and not `strict`: the cookie has to survive X redirecting the
    // browser back to us, which is a cross-site navigation. `strict` would drop
    // it exactly at the callback and every login would fail.
    sameSite: 'lax',
    path: '/',
    maxAge: FLOW_MAX_AGE,
  })
}

export async function readFlowCookie(): Promise<FlowState | null> {
  const store = await cookies()
  const raw = store.get(FLOW_COOKIE)?.value
  if (!raw) return null
  const [payload, signature] = raw.split('.')
  if (!payload || !signature || !verify(payload, signature)) return null
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as FlowState
  } catch {
    return null
  }
}

export async function clearFlowCookie(): Promise<void> {
  const store = await cookies()
  store.delete(FLOW_COOKIE)
}

// ---------------------------------------------------------------------------
// The session: a signed handle and nothing else
// ---------------------------------------------------------------------------

/**
 * We store the handle, not the access token.
 *
 * The token is used once, server-side, to ask X who this is, and then dropped.
 * Keeping it would mean holding a credential that can read someone's account,
 * for a product whose entire promise is that it only reads public numbers.
 */
export async function setSession(handle: string): Promise<void> {
  const store = await cookies()
  const payload = `${handle}.${Date.now()}`
  const encoded = Buffer.from(payload).toString('base64url')
  store.set(SESSION_COOKIE, `${encoded}.${sign(encoded)}`, {
    httpOnly: true,
    secure: siteOrigin().startsWith('https'),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

/** The verified handle of whoever is asking, or null. Never trust a body for this. */
export async function sessionHandle(): Promise<string | null> {
  const store = await cookies()
  const raw = store.get(SESSION_COOKIE)?.value
  if (!raw) return null
  const [encoded, signature] = raw.split('.')
  if (!encoded || !signature || !verify(encoded, signature)) return null

  const [handle, issued] = Buffer.from(encoded, 'base64url').toString().split('.')
  if (!handle || !issued) return null
  // maxAge already expires the cookie in the browser; this is the server-side
  // half, for a cookie replayed by something that ignores it.
  if (Date.now() - Number(issued) > SESSION_MAX_AGE * 1000) return null
  return handle
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

// ---------------------------------------------------------------------------
// Talking to X
// ---------------------------------------------------------------------------

/**
 * Authorization code + verifier in, the verified username out.
 *
 * Returns null on every failure rather than throwing detail: the caller turns
 * this into "sign-in failed", and an OAuth error message is not something to
 * render back to a browser.
 */
export async function verifiedHandle(
  credentials: XCredentials,
  code: string,
  verifier: string,
): Promise<string | null> {
  try {
    const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString(
      'base64',
    )
    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(),
        code_verifier: verifier,
        client_id: credentials.clientId,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!tokenResponse.ok) return null

    const token = (await tokenResponse.json()) as { access_token?: unknown }
    if (typeof token.access_token !== 'string') return null

    const meResponse = await fetch(ME_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!meResponse.ok) return null

    const me = (await meResponse.json()) as { data?: { username?: unknown } }
    const username = me.data?.username
    if (typeof username !== 'string' || username.length === 0) return null

    // Lowercased to match how handles are stored everywhere else. X treats
    // usernames case-insensitively; our primary key does not.
    return username.toLowerCase()
  } catch {
    return null
  }
}
