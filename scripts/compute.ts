/**
 * Runs the compute step locally, without a web server in the way.
 *
 * Production goes through /api/cron/compute — the crawl workflow calls it in a
 * step that always runs, and a Vercel Cron catches the case where the workflow
 * never ran at all. Note that this script does NOT revalidate anything: it
 * computes, and the site keeps serving yesterday's cached pages until something
 * hits the route. This script is the same function, for local work and for
 * repair after a `pnpm schema:apply --reset`.
 *
 *   pnpm compute
 */

import { computeAll } from '../lib/compute'
import { directDb } from '../lib/db'

async function main() {
  const sql = directDb()
  try {
    const report = await computeAll(sql)
    console.log(
      `✓ ${report.founders} founders, ${report.startups} startups, ` +
        `${report.achievementsGranted} new achievements, ${report.edges} guild edges` +
        (report.charactersRemoved > 0 ? `, ${report.charactersRemoved} delisted` : '') +
        ` (${report.durationMs} ms)`,
    )
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
