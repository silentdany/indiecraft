/**
 * Runs the compute step locally, without a web server in the way.
 *
 * Production goes through /api/cron/compute — the crawler calls it at the end
 * of its run, and a Vercel Cron catches the case where the run died first.
 * This script is the same function, for local work and for repair after a
 * `pnpm schema:apply --reset`.
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
        `${report.achievementsGranted} new achievements, ${report.edges} guild edges ` +
        `(${report.durationMs} ms)`,
    )
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
