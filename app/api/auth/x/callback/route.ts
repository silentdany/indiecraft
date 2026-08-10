import {
  authMode,
  clearFlowCookie,
  readFlowCookie,
  setSession,
  siteOrigin,
  verifiedHandle,
  xCredentials,
} from '@/lib/auth'
import { fetchScreenName, xConsumer } from '@/lib/auth-oauth1'

/**
 * Step two: X sends the browser back, and we find out who it is.
 *
 * Every failure path lands on the same place with `?auth=failed`, because the
 * difference between "state mismatch" and "token exchange rejected" is
 * diagnostic detail for us and noise for the person, and telling an attacker
 * which check they tripped is how you help them past it. The detail goes to the
 * log instead — see lib/auth.ts.
 */
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const mode = authMode()
  if (!mode) return Response.json({ error: 'not found' }, { status: 404 })

  const url = new URL(request.url)
  const flow = await readFlowCookie()
  await clearFlowCookie()

  const back = (path: string) => Response.redirect(`${siteOrigin()}${path}`, 302)
  const failed = () => back(`${flow?.next ?? '/'}?auth=failed`)

  // X reports a refusal here rather than at the token step — the person pressed
  // Cancel, or the app lacks a permission. Worth separating from our own faults.
  const denied = url.searchParams.get('error') ?? url.searchParams.get('denied')
  if (denied) {
    console.error('[auth] X refused at the authorize step:', denied)
    return failed()
  }

  if (!flow) {
    console.error('[auth] no flow cookie at the callback — it did not survive the round trip')
    return failed()
  }

  if (mode === 'oauth1') {
    const consumer = xConsumer()
    const token = url.searchParams.get('oauth_token')
    const verifier = url.searchParams.get('oauth_verifier')

    // `flow.state` holds the request token. X echoing back a different one means
    // this callback belongs to somebody else's handshake — the 1.0a equivalent
    // of a state mismatch, and the same CSRF defence.
    if (!consumer || !token || !verifier || token !== flow.state) {
      console.error('[auth1] callback preconditions failed:', {
        hasConsumer: Boolean(consumer),
        hasToken: Boolean(token),
        hasVerifier: Boolean(verifier),
        tokenMatches: token === flow.state,
      })
      return failed()
    }

    const handle = await fetchScreenName(consumer, token, flow.verifier, verifier)
    if (!handle) return failed()

    await setSession(handle)
    return back(flow.next)
  }

  const credentials = xCredentials()
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  // The state check is the CSRF defence: without it somebody can hand a victim
  // a callback URL carrying the attacker's authorization code, and the victim's
  // browser quietly ends up signed in as the attacker.
  if (!credentials || !code || !state || state !== flow.state) {
    console.error('[auth] callback preconditions failed:', {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      stateMatches: Boolean(state && state === flow.state),
    })
    return failed()
  }

  const handle = await verifiedHandle(credentials, code, flow.verifier)
  if (!handle) return failed()

  await setSession(handle)
  return back(flow.next)
}
