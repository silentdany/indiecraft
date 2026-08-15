import { revalidatePath, revalidateTag } from 'next/cache'
import { computeAll } from '@/lib/compute'
import { directDb } from '@/lib/db'
import { CORPUS_TAG } from '@/lib/queries'

/**
 * Vercel Cron only keeps the compute step: it's fast, and everything is already
 * in the database. The crawl itself takes ~15 minutes and lives on GitHub
 * Actions.
 *
 * The daily 03:30 UTC entry in vercel.json is a safety net, not the trigger —
 * the crawler calls this route itself at the end of its run, and the cron only
 * matters when that run died before getting here. (vercel.json carries no note
 * of its own because the schema rejects unknown keys, comments included.)
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
