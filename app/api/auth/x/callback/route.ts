import {
  clearFlowCookie,
  readFlowCookie,
  setSession,
  siteOrigin,
  verifiedHandle,
  xCredentials,
} from '@/lib/auth'

/**
 * Step two: X sends the browser back, and we find out who it is.
 *
 * Every failure path lands on the same place with `?auth=failed`, because the
 * difference between "state mismatch" and "token exchange rejected" is
 * diagnostic detail for us and noise for the person, and telling an attacker
 * which check they tripped is how you help them past it.
 */
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const credentials = xCredentials()
  if (!credentials) return Response.json({ error: 'not found' }, { status: 404 })

  const url = new URL(request.url)
  const flow = await readFlowCookie()
  await clearFlowCookie()

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const back = (path: string) => Response.redirect(`${siteOrigin()}${path}`, 302)
  const failed = () => back(`${flow?.next ?? '/'}?auth=failed`)

  // The state check is the CSRF defence: without it somebody can hand a victim
  // a callback URL carrying the attacker's authorization code, and the victim's
  // browser quietly ends up signed in as the attacker.
  if (!flow || !code || !state || state !== flow.state) return failed()

  const handle = await verifiedHandle(credentials, code, flow.verifier)
  if (!handle) return failed()

  await setSession(handle)
  return back(flow.next)
}
