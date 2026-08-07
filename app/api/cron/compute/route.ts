import { computeAll } from '@/lib/compute'
import { db } from '@/lib/db'

/**
 * Vercel Cron only keeps the compute step: it's fast, and everything is already
 * in the database. The crawl itself takes ~50 minutes and lives on GitHub
 * Actions.
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
  try {
    const report = await computeAll(db())
    return Response.json({ ok: true, ...report })
  } catch (error) {
    console.error('compute', error)
    return Response.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
