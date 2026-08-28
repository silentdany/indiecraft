import { revalidatePath, revalidateTag } from 'next/cache'
import { computeAll } from '@/lib/compute'
import { directDb } from '@/lib/db'
import { CORPUS_TAG } from '@/lib/queries'

/**
 * Vercel Cron only keeps the compute step: it's fast, and everything is already
 * in the database. The crawl itself takes ~2.5 hours and lives on GitHub
 * Actions.
 *
 * Two callers, and they cover different failures.
 *
 * The crawl workflow calls this in a step marked `if: always()`, so it happens
 * whether the night finished, failed, or ran out of time. That is the real
 * trigger and it is the one that knows when a collection actually ended.
 *
 * The daily 07:00 UTC entry in vercel.json covers the case that step cannot:
 * the GitHub run never happening at all. It used to be 03:30, which sounds like
 * "after the 02:00 crawl" and is not — GitHub starts scheduled runs late, by an
 * hour most nights and by ten on 2026-08-27, so 03:30 landed before or during
 * every crawl it was supposed to follow and never once caught a failed one.
 *
 * It runs unconditionally, and "there is no new data" is not a reason to skip:
 * computeAll writes today's character_days row from `current_date` and settles
 * whatever fell due by `due_on`. A day nobody computes is a permanent hole in
 * every founder's history and a promise left hanging, new snapshots or not.
 *
 * (vercel.json carries no note of its own because the schema rejects unknown
 * keys, comments included.)
 */
export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  // The direct (session pooler) connection, not the pooled one the pages use.
  //
  // computeAll runs one transaction of several hundred statements. On the
  // transaction pooler that hangs indefinitely — the request never returned,
  // not even after three minutes, while the identical code against the session
  // pooler finished in seconds. `scripts/compute.ts` was right and this route
  // was wrong, which is exactly why the local run passed and production did
  // not.
  //
  // Opened and closed per invocation: this is a one-shot job, so a cached pool
  // would only leave a connection behind after the function froze.
  const sql = directDb()
  try {
    const report = await computeAll(sql)

    /*
     * New numbers exist; nothing is showing them yet.
     *
     * Every page holds its render for a day now, because the data only changes
     * here. That window is only tolerable if this call closes it — without it a
     * founder who levelled up overnight would keep seeing yesterday's sheet
     * until the ISR clock happened to expire.
     *
     * From a Route Handler both of these only MARK the entries; the work
     * happens on the next visit to each path. That is the property that makes
     * it safe to invalidate 2,600 character pages in one line — there is no
     * stampede, just a cache miss for whoever arrives first.
     *
     * The dynamic-segment forms need their `type`, and passing the literal
     * path instead silently revalidates nothing.
     */
    revalidateTag(CORPUS_TAG, 'max')
    revalidatePath('/')
    revalidatePath('/rules')
    revalidatePath('/ladder')
    revalidatePath('/compare')
    revalidatePath('/c/[handle]', 'page')
    revalidatePath('/c/[handle]/vs/[other]', 'page')

    return Response.json({ ok: true, ...report })
  } catch (error) {
    console.error('compute', error)
    return Response.json({ ok: false, error: (error as Error).message }, { status: 500 })
  } finally {
    await sql.end({ timeout: 5 })
  }
}

export const GET = handle
export const POST = handle
