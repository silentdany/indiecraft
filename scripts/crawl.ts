/**
 * The crawler.
 *
 * Runs on GitHub Actions, never on Vercel. The corpus is ~200 startups (the
 * spec's 840 was a guess; `meta.total` says otherwise), listed 10 per page, so
 * a full run is ~20 list requests plus ~200 detail requests at a 3.5s throttle:
 * roughly thirteen minutes. Still well past a serverless function's ceiling,
 * so the architectural call stands.
 *
 * Every day without a collection is a day of history permanently lost — the API
 * only ever returns current state. A failed slug never aborts the run.
 *
 * Usage:
 *   pnpm crawl
 *   pnpm crawl --limit 20        short run, to check the wiring
 *   pnpm crawl --dump-slugs      dump the channel / techStack vocabularies
 *   pnpm crawl --no-compute      skip the follow-up compute step
 */

import { directDb } from '../lib/db'
import {
  asDate,
  asInt,
  asNumber,
  normalizeHandle,
  TrustmrrClient,
  type TrustmrrStartup,
  toCents,
} from '../lib/trustmrr'

interface Options {
  limit?: number
  dumpSlugs: boolean
  compute: boolean
}

function parseArgs(argv: string[]): Options {
  const limitFlag = argv.indexOf('--limit')
  return {
    limit: limitFlag >= 0 ? Number(argv[limitFlag + 1]) : undefined,
    dumpSlugs: argv.includes('--dump-slugs'),
    compute: !argv.includes('--no-compute'),
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const client = new TrustmrrClient(process.env.TRUSTMRR_API_KEY ?? '')
  const sql = directDb()
  const startedAt = Date.now()

  const channelSlugs = new Set<string>()
  const stackSlugs = new Set<string>()
  const failures: string[] = []
  let inserted = 0

  try {
    console.log('→ listing startups…')
    const slugs = await client.listSlugs(options.limit)
    console.log(
      `  ${slugs.length} slugs, ~${Math.round((slugs.length * 3.5) / 60)} min of crawling`,
    )

    for (const [index, slug] of slugs.entries()) {
      let detail: TrustmrrStartup
      try {
        detail = await client.detail(slug)
      } catch (error) {
        // Skip and log. The run continues: losing one slug costs less than
        // losing the night.
        failures.push(slug)
        console.warn(`  ✗ ${slug} — ${(error as Error).message}`)
        continue
      }

      for (const c of detail.marketingChannels ?? []) if (c?.slug) channelSlugs.add(c.slug)
      for (const t of detail.techStack ?? []) if (t?.slug) stackSlugs.add(t.slug)

      await persist(sql, slug, detail)
      inserted++

      if ((index + 1) % 25 === 0) {
        console.log(`  ${index + 1}/${slugs.length} — ${minutesSince(startedAt)} min`)
      }
    }

    console.log(
      `\n✓ ${inserted} snapshots, ${failures.length} failures, ${minutesSince(startedAt)} min`,
    )
    if (failures.length) console.log(`  failed slugs: ${failures.join(', ')}`)

    if (options.dumpSlugs) {
      console.log('\n--- marketingChannels[].slug ---')
      console.log([...channelSlugs].sort().join('\n'))
      console.log('\n--- techStack[].slug ---')
      console.log([...stackSlugs].sort().join('\n'))
      console.log('\nCopy these lists into engine/tuning.ts.')
    }

    if (options.compute) await triggerCompute()
  } finally {
    await sql.end()
  }
}

/**
 * Insert one snapshot per startup per run.
 *
 * Always store the raw JSON: extracted columns can be recomputed, a lost
 * payload never comes back. An API change is absorbed by the jsonb column.
 *
 * Idempotent per day — re-running an interrupted run repairs partial rows
 * instead of failing.
 */
async function persist(
  sql: ReturnType<typeof directDb>,
  slug: string,
  detail: TrustmrrStartup,
): Promise<void> {
  const handle = normalizeHandle(detail.xHandle)
  const fundingStatus = detail.startupInsights?.fundingStatus ?? null

  await sql`
    insert into snapshots (
      source, startup_slug, raw,
      mrr_cents, revenue_total_cents, last30d_cents,
      customers, active_subscriptions, growth_mrr_30d,
      domain_rating, visitors_30d, funding_status, founded_date, founder_handle
    ) values (
      'trustmrr', ${slug}, ${sql.json(detail as never)},
      ${toCents(detail.revenue?.mrr)}, ${toCents(detail.revenue?.total)}, ${toCents(detail.revenue?.last30Days)},
      ${asInt(detail.customers)}, ${asInt(detail.activeSubscriptions)}, ${asNumber(detail.growthMRR30d)},
      ${asInt(detail.domainRating)}, ${asInt(detail.visitorsLast30Days)},
      ${fundingStatus}, ${asDate(detail.foundedDate)}, ${handle}
    )
    on conflict (source, startup_slug, captured_on) do update set
      raw = excluded.raw,
      mrr_cents = excluded.mrr_cents,
      revenue_total_cents = excluded.revenue_total_cents,
      last30d_cents = excluded.last30d_cents,
      customers = excluded.customers,
      active_subscriptions = excluded.active_subscriptions,
      growth_mrr_30d = excluded.growth_mrr_30d,
      domain_rating = excluded.domain_rating,
      visitors_30d = excluded.visitors_30d,
      funding_status = excluded.funding_status,
      founded_date = excluded.founded_date,
      founder_handle = excluded.founder_handle,
      captured_at = now()
  `

  // A slug seen yesterday and absent today is never deleted: only last_seen_at
  // stops advancing.
  await sql`
    insert into startups (slug, name, website, icon_url, founder_handle, funding_status)
    values (${slug}, ${detail.name ?? null}, ${detail.website ?? null},
            ${detail.icon ?? null}, ${handle}, ${fundingStatus})
    on conflict (slug) do update set
      name = excluded.name,
      website = excluded.website,
      icon_url = excluded.icon_url,
      founder_handle = excluded.founder_handle,
      funding_status = excluded.funding_status,
      last_seen_at = now()
  `
}

/** Last step of the sequence: kick off the compute. */
async function triggerCompute(): Promise<void> {
  const base = process.env.NEXT_PUBLIC_SITE_URL
  const secret = process.env.CRON_SECRET
  if (!base || !secret) {
    console.log('→ compute not triggered (NEXT_PUBLIC_SITE_URL or CRON_SECRET missing)')
    return
  }
  const res = await fetch(`${base}/api/cron/compute`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  })
  console.log(`→ compute triggered: ${res.status}`)
}

const minutesSince = (from: number) => Math.round((Date.now() - from) / 60_000)

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
