import { createHmac, randomBytes } from 'node:crypto'

/**
 * Sign in with X, the 1.0a way.
 *
 * OAuth 2.0 was implemented first and works perfectly right up to the last
 * step, where it needs `GET /2/users/me` to ask who just logged in — and that
 * endpoint is entitlement-gated. An app that is not enrolled in a project with
 * v2 access gets 403 `client-not-enrolled` while holding a perfectly valid
 * token, which is a confusing enough failure to have cost most of an afternoon.
 *
 * 1.0a needs no endpoint at all. Its access-token response is form-encoded and
 * carries `screen_name` in the body:
 *
 *   oauth_token=…&oauth_token_secret=…&user_id=…&screen_name=majorbaguette
 *
 * So the handle arrives as part of the handshake rather than from an API call,
 * and no tier, project or product entitlement can take it away. The three
 * /oauth/* endpoints below are available to every app that has "Sign in with X"
 * switched on.
 *
 * The trade is that requests must be signed, which is the fiddly part and the
 * reason this file exists rather than a fetch call inline. Every detail here —
 * the encoding, the sorting, the empty token secret on the first call — is
 * load-bearing: get one wrong and X answers 401 with no explanation.
 */

const REQUEST_TOKEN_URL = 'https://api.x.com/oauth/request_token'
/**
 * `authenticate`, not `authorize`. The former reuses an existing approval and
 * sends the user straight back; the latter forces the allow screen every single
 * time, which for a one-click claim is friction nobody needs.
 */
const AUTHENTICATE_URL = 'https://api.x.com/oauth/authenticate'
const ACCESS_TOKEN_URL = 'https://api.x.com/oauth/access_token'

export interface XConsumer {
  key: string
  secret: string
}

/** Null until the OAuth 1.0a consumer keys are set. */
export function xConsumer(): XConsumer | null {
  const key = process.env.X_API_KEY
  const secret = process.env.X_API_SECRET
  if (!key || !secret) return null
  return { key, secret }
}

/**
 * RFC 3986, which is stricter than `encodeURIComponent`.
 *
 * The four characters below are the whole difference, and a signature computed
 * with the looser encoding is wrong in a way that only shows up for handles and
 * callbacks that happen to contain them.
 */
function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

/**
 * The signature base string: method, URL and every parameter, sorted and
 * encoded twice over. Sorting is by encoded key, then encoded value.
 */
function signature(
  method: 'POST' | 'GET',
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string,
): string {
  const normalised = Object.keys(params)
    .map((key) => [rfc3986(key), rfc3986(params[key] ?? '')] as const)
    .sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  const base = [method, rfc3986(url), rfc3986(normalised)].join('&')
  // The token secret is empty on the very first call, and the ampersand is
  // still required. Omitting it is the classic 401.
  const key = `${rfc3986(consumerSecret)}&${rfc3986(tokenSecret)}`
  return createHmac('sha1', key).update(base).digest('base64')
}

function authHeader(
  method: 'POST' | 'GET',
  url: string,
  consumer: XConsumer,
  extra: Record<string, string>,
  tokenSecret = '',
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: consumer.key,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
    ...extra,
  }
  oauth.oauth_signature = signature(method, url, oauth, consumer.secret, tokenSecret)

  return `OAuth ${Object.keys(oauth)
    .sort()
    .map((k) => `${rfc3986(k)}="${rfc3986(oauth[k] ?? '')}"`)
    .join(', ')}`
}

/** X answers these three endpoints in form encoding, not JSON. */
function parseForm(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of new URLSearchParams(body)) out[key] = value
  return out
}

export interface RequestToken {
  token: string
  secret: string
}

/**
 * Step one: ask X for a request token, naming the callback.
 *
 * The callback is signed into this call, so it cannot be tampered with later —
 * and X checks it against the ones registered on the app.
 */
export async function fetchRequestToken(
  consumer: XConsumer,
  callbackUrl: string,
): Promise<RequestToken | null> {
  try {
    const response = await fetch(REQUEST_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: authHeader('POST', REQUEST_TOKEN_URL, consumer, {
          oauth_callback: callbackUrl,
        }),
      },
      signal: AbortSignal.timeout(8000),
    })
    const body = await response.text()
    if (!response.ok) {
      console.error('[auth1] request_token rejected', response.status, body.slice(0, 400))
      return null
    }

    const parsed = parseForm(body)
    // X confirms it honoured the callback. If this is not 'true' the app has no
    // callback registered, and the user would end up stranded on x.com.
    if (parsed.oauth_callback_confirmed !== 'true') {
      console.error(
        '[auth1] callback not confirmed — is it registered on the app?',
        body.slice(0, 200),
      )
      return null
    }
    const token = parsed.oauth_token
    const secret = parsed.oauth_token_secret
    if (!token || !secret) return null
    return { token, secret }
  } catch (error) {
    console.error('[auth1] request_token threw', (error as Error).message)
    return null
  }
}

export function authenticateUrl(requestToken: string): string {
  return `${AUTHENTICATE_URL}?oauth_token=${rfc3986(requestToken)}`
}

/**
 * Step three: swap the verifier for the handle.
 *
 * The access token and its secret come back too and are deliberately dropped on
 * the floor — this product reads public numbers and has no business holding a
 * credential that can act as somebody.
 */
export async function fetchScreenName(
  consumer: XConsumer,
  requestToken: string,
  requestSecret: string,
  verifier: string,
): Promise<string | null> {
  try {
    const response = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: authHeader(
          'POST',
          ACCESS_TOKEN_URL,
          consumer,
          { oauth_token: requestToken, oauth_verifier: verifier },
          requestSecret,
        ),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ oauth_verifier: verifier }),
      signal: AbortSignal.timeout(8000),
    })
    const body = await response.text()
    if (!response.ok) {
      console.error('[auth1] access_token rejected', response.status, body.slice(0, 400))
      return null
    }

    const screenName = parseForm(body).screen_name
    if (!screenName) {
      console.error('[auth1] access_token carried no screen_name')
      return null
    }
    // Lowercased to match how handles are stored everywhere else.
    return screenName.toLowerCase()
  } catch (error) {
    console.error('[auth1] access_token threw', (error as Error).message)
    return null
  }
}
