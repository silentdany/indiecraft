import { computeAll } from '@/lib/compute'
import { directDb } from '@/lib/db'

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
