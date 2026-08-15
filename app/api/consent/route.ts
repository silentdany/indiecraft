import { revalidatePath, revalidateTag } from 'next/cache'
import { authMode, sessionHandle } from '@/lib/auth'
import { clientIp, hashIp, OPT_OUT_MAX_PER_HOUR } from '@/lib/consent'
import { db } from '@/lib/db'
import { CORPUS_TAG } from '@/lib/queries'

/**
 * Claim, unclaim, and remove — all three on the handle X said you are.
 *
 * This replaces an endpoint that took the handle from the request body, which
 * meant "anyone can remove their own sheet" was also "anyone can remove
 * anyone's", and /ladder hands out a hundred handles at a time. The fix is not
 * a better rate limit. It is that the body no longer names a target: the only
 * handle this route can act on is the one in the signed session cookie.
 *
 * Removal stays one click and no email — the spec's rule is about how few steps
 * it takes to leave, and signing in with the account we already crawled is not
 * a step somebody has to think about. What it removes is a stranger's ability
 * to take that step for you.
 *
 * Every request is written to consent_events first, refused ones included: that
 * table is the audit trail, the rate limiter, and the thing that survives a
 * `schema:apply --reset`.
 */
export const runtime = 'nodejs'

type Action = 'claim' | 'unclaim' | 'opt_out'

export async function POST(request: Request) {
  if (!authMode()) return Response.json({ error: 'not found' }, { status: 404 })

  const handle = await sessionHandle()
  if (!handle) return Response.json({ error: 'sign in first' }, { status: 401 })

  let action: Action
  try {
    const body = (await request.json()) as { action?: unknown }
    if (body.action !== 'claim' && body.action !== 'unclaim' && body.action !== 'opt_out') {
      throw new Error('bad action')
    }
    action = body.action
  } catch {
    return Response.json({ error: 'invalid request' }, { status: 400 })
  }

  const sql = db()
  const ipHash = hashIp(clientIp(request))

  // 'unclaim' is not one of the two actions consent_events records, and it must
  // not be: that table replays onto `founders` after a reset, and an unclaim
  // event would have to cancel an earlier claim rather than add to it. Instead
  // the claim event stays and claimed_at is cleared, which the replay reads as
  // "claimed" again — so unclaiming is deliberately not durable across a reset.
  // Nobody loses a sheet that way; the worst case is a sheet becoming indexable
  // again after an operation nobody but us performs.
  if (action !== 'unclaim') {
    await sql`
      insert into consent_events (handle, action, ip_hash, user_agent)
      values (${handle}, ${action}, ${ipHash}, ${request.headers.get('user-agent')})
    `
  }

  if (action === 'opt_out' && ipHash) {
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

  let changed = 0
  if (action === 'claim') {
    // Claiming also undoes a removal, and that is the only way back: a removed
    // sheet 404s, so its owner cannot reach the page to change their mind.
    // Only the person who can sign in as this handle can do it.
    const result = await sql`
      update founders set claimed_at = coalesce(claimed_at, now()), opted_out_at = null
      where handle = ${handle}
    `
    changed = result.count
  } else if (action === 'unclaim') {
    // Unclaiming is not removal. It puts the sheet back to noindex and out of
    // the sitemap, which is the middle option somebody who regrets being
    // findable actually wants — the alternative was "delete everything".
    const result = await sql`update founders set claimed_at = null where handle = ${handle}`
    changed = result.count
  } else {
    const result = await sql`
      update founders set opted_out_at = now()
      where handle = ${handle} and opted_out_at is null
    `
    changed = result.count
  }

  /*
   * `expire: 0`, not the 'max' the compute route uses, and the difference is
   * the whole point.
   *
   * 'max' marks a tag stale and serves the stale copy while fresh data loads —
   * exactly right for a nightly recompute, where nobody is harmed by seeing
   * yesterday's rank for one more request. It is exactly wrong here: the stale
   * copy of somebody who just opted out is their sheet, still public, and
   * "one more request" is the request that matters.
   *
   * Expiring the tag rather than only the paths because the reads behind those
   * paths are cached too now. revalidatePath alone would re-render the page and
   * the cached query would hand it the same removed founder.
   */
  revalidateTag(CORPUS_TAG, { expire: 0 })
  revalidatePath(`/c/${handle}`)
  revalidatePath('/ladder')
  revalidatePath('/sitemap.xml')

  return Response.json({ ok: true, changed })
}
