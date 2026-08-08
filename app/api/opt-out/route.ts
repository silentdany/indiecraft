import { revalidatePath } from 'next/cache'
import { CONSENT_ACTIONS_ENABLED, clientIp, hashIp, OPT_OUT_MAX_PER_HOUR } from '@/lib/consent'
import { db } from '@/lib/db'

/**
 * One-click opt-out.
 *
 * No account, no email, applied immediately. That is deliberate: we crawl the
 * numbers of people who never asked for any of this, so leaving must cost less
 * than arriving. Nothing below may add a step to that.
 *
 * Every request is written to consent_events first, refused ones included —
 * that table is both the audit trail and the rate limiter, so a mass wipe is
 * visible and reversible instead of silent.
 */
export const runtime = 'nodejs'

export async function POST(request: Request) {
  // Disabled at the route, not just in the interface: a hidden button in front
  // of a live endpoint protects nobody on a public repo. 404 rather than 403 —
  // there is nothing here to describe.
  if (!CONSENT_ACTIONS_ENABLED) {
    return Response.json({ error: 'not found' }, { status: 404 })
  }

  let handle: string
  try {
    const body = (await request.json()) as { handle?: unknown }
    if (typeof body.handle !== 'string') throw new Error('missing handle')
    handle = body.handle.replace(/^@/, '').toLowerCase()
  } catch {
    return Response.json({ error: 'invalid request' }, { status: 400 })
  }

  const sql = db()
  const ipHash = hashIp(clientIp(request))

  // Log the attempt before deciding on it: a refused burst is exactly the
  // signal we want on record.
  await sql`
    insert into consent_events (handle, action, ip_hash, user_agent)
    values (${handle}, 'opt_out', ${ipHash}, ${request.headers.get('user-agent')})
  `

  if (ipHash) {
    const [recent] = await sql<{ n: number }[]>`
      select count(*)::int as n from consent_events
      where ip_hash = ${ipHash}
        and action = 'opt_out'
        and occurred_at > now() - interval '1 hour'
    `
    if ((recent?.n ?? 0) > OPT_OUT_MAX_PER_HOUR) {
      return Response.json(
        { error: 'too many removal requests from this address, try again later' },
        { status: 429 },
      )
    }
  }

  const result = await sql`
    update founders set opted_out_at = now()
    where handle = ${handle} and opted_out_at is null
  `

  revalidatePath(`/c/${handle}`)
  revalidatePath('/ladder')

  return Response.json({ ok: true, changed: result.count })
}
