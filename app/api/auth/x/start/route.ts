import {
  authMode,
  authorizeUrl,
  newFlow,
  redirectUri,
  setFlowCookie,
  xCredentials,
} from '@/lib/auth'
import { authenticateUrl, fetchRequestToken, xConsumer } from '@/lib/auth-oauth1'

/**
 * Step one: send the browser to X.
 *
 * A GET rather than a POST because it is a plain navigation the user initiated
 * by clicking a link, and because the response is a redirect to another origin.
 *
 * Two handshakes live here. 1.0a is preferred where the consumer keys exist,
 * because it needs no v2 entitlement — see lib/auth-oauth1.ts. It also costs a
 * server round trip before the redirect, which 2.0 does not: the request token
 * has to be fetched and remembered before the user goes anywhere.
 */
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const mode = authMode()
  // 404 rather than 503: with no app registered there is no sign-in here to
  // describe, and the button that points at this route is absent too.
  if (!mode) return Response.json({ error: 'not found' }, { status: 404 })

  const url = new URL(request.url)
  const next = safeNext(url.searchParams.get('next'))

  if (mode === 'oauth1') {
    const consumer = xConsumer()
    if (!consumer) return Response.json({ error: 'not found' }, { status: 404 })

    const requestToken = await fetchRequestToken(consumer, redirectUri())
    if (!requestToken) {
      // Nothing the person can do about it, and the reason is in the log.
      return Response.redirect(`${new URL(next, url.origin)}?auth=failed`, 302)
    }

    // The request token's secret is what signs the final exchange, so it rides
    // in the same signed cookie the 2.0 flow uses for its PKCE verifier.
    await setFlowCookie({ verifier: requestToken.secret, state: requestToken.token, next })
    return Response.redirect(authenticateUrl(requestToken.token), 302)
  }

  const credentials = xCredentials()
  if (!credentials) return Response.json({ error: 'not found' }, { status: 404 })
  const flow = newFlow(next)
  await setFlowCookie(flow)
  return Response.redirect(authorizeUrl(credentials, flow), 302)
}

/**
 * Only same-site paths come back out of this.
 *
 * `next` arrives in a query string, which means anyone can put anything in it.
 * Echoing it into a redirect unchecked is an open redirect: a link to our
 * domain that lands on somebody else's, which is worth real money to a phisher
 * precisely because the first hop looks legitimate.
 */
function safeNext(value: string | null): string {
  if (!value?.startsWith('/')) return '/'
  // `//evil.com` is a protocol-relative URL, not a path, and browsers follow it
  // off-site. `/\evil.com` is the same trick with the other slash.
  if (value.startsWith('//') || value.startsWith('/\\')) return '/'
  return value
}
