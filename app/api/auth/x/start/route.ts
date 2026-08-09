import { authorizeUrl, newFlow, setFlowCookie, xCredentials } from '@/lib/auth'

/**
 * Step one: send the browser to X.
 *
 * A GET rather than a POST because it is a plain navigation the user initiated
 * by clicking a link, and because the response is a redirect to another origin.
 */
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const credentials = xCredentials()
  // 404 rather than 503: with no app registered there is no sign-in here to
  // describe, and the button that points at this route is absent too.
  if (!credentials) return Response.json({ error: 'not found' }, { status: 404 })

  const url = new URL(request.url)
  const flow = newFlow(safeNext(url.searchParams.get('next')))
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
