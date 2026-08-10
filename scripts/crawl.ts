/**
 * The crawler.
 *
 * Runs on GitHub Actions, never on Vercel: a run is hours long, which is well
 * past a serverless function's ceiling.
 *
 * ---------------------------------------------------------------------------
 * The corpus is ~9,000 startups, not the ~200 this file used to claim.
 *
 * `meta.total` on the list endpoint says 200 and means "200 in this list", not
 * "200 in the corpus". Page 21 comes back empty, `limit=100` still returns 10,
 * and nothing in the response uses the word "top". So for its whole life this
 * crawler collected the same top 200 by rank every night, and nine tenths of
 * TrustMRR did not exist as far as the armory was concerned — a founder outside
 * that 200 could look themselves up and find nothing.
 *
 * Discovery now comes from TrustMRR's own sitemap, which robots.txt names and
 * allows. Detail lookups still go through the API at the same throttle.
 * ---------------------------------------------------------------------------
 *
 * One night cannot hold 9,000 slugs at 4s apiece — that is ten hours against a
 * 180-minute ceiling — so a run takes the ranked 200 plus the stalest slice of
 * everything else. Coverage grows every night and then keeps rotating.
 *
 * Every day without a collection is a day of history permanently lost: the API
 * only ever returns current state. A failed slug never aborts the run.
 *
 * Usage:
 *   pnpm crawl
 *   pnpm crawl --budget 2000     collect more of the tail in one run
 *   pnpm crawl --slug brieform   one startup, comma-separated for several
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

/**
 * How many slugs one nightly run may collect.
 *
 * At a 4s throttle plus request time this lands around 100 minutes, inside the
 * workflow's 180-minute ceiling with room for retries. The corpus is ~9,000, so
 * full coverage takes about a fortnight of nights and then keeps rotating —
 * which is the right trade: a run that tried to do all of it in one night would
 * take ten hours, exceed the ceiling, and collect nothing at all.
 */
const DEFAULT_BUDGET = 900

interface Options {
  limit?: number
  budget: number
  /** Crawl exactly these slugs and nothing else. */
  only: string[]
  dumpSlugs: boolean
  compute: boolean
}

function parseArgs(argv: string[]): Options {
  const flag = (name: string) => {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const only = flag('--slug')
  return {
    limit: flag('--limit') ? Number(flag('--limit')) : undefined,
    budget: flag('--budget') ? Number(flag('--budget')) : DEFAULT_BUDGET,
    only: only
      ? only
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    dumpSlugs: argv.includes('--dump-slugs'),
    compute: !argv.includes('--no-compute'),
  }
}

/**
 * What to collect tonight: the ranked list first, then the stalest of the rest.
 *
 * The ranked 200 are the ladder and are refreshed every night without fail.
 * Everything else rotates by staleness — never-collected slugs before
 * least-recently-collected — so coverage grows monotonically and no startup can
 * be starved by the ordering.
 */
async function planRun(
  sql: ReturnType<typeof directDb>,
  client: TrustmrrClient,
  options: Options,
): Promise<string[]> {
  if (options.only.length > 0) return options.only

  const ranked = await client.listSlugs(options.limit)
  console.log(`  ${ranked.length} ranked (the API list is capped here)`)
  if (options.limit) return ranked.slice(0, options.limit)

  let discovered: string[] = []
  try {
    discovered = await client.sitemapSlugs()
    console.log(`  ${discovered.length} in the sitemap`)
  } catch (error) {
    // A missing sitemap costs tonight's expansion, never tonight's ladder.
    console.warn(`  ✗ sitemap — ${(error as Error).message}`)
    return ranked
  }

  const rankedSet = new Set(ranked)
  const rest = discovered.filter((slug) => !rankedSet.has(slug))
  const room = Math.max(0, options.budget - ranked.length)
  if (room === 0) return ranked

  // Slugs we have never captured sort first (no row → null → nulls first),
  // then the ones we have not seen in longest.
  const seen = await sql<{ startup_slug: string; last_on: string | null }[]>`
    select startup_slug, max(captured_on)::text as last_on
    from snapshots group by startup_slug
  `
  const lastSeen = new Map(seen.map((r) => [r.startup_slug, r.last_on ?? '']))
  const queued = rest
    .map((slug) => ({ slug, last: lastSeen.get(slug) }))
    .sort((a, b) => (a.last ?? '').localeCompare(b.last ?? ''))
    .slice(0, room)
    .map((r) => r.slug)

  const fresh = queued.filter((s) => !lastSeen.has(s)).length
  console.log(`  + ${queued.length} rotating (${fresh} never collected before)`)
  return [...ranked, ...queued]
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
    console.log('→ planning the run…')
    const slugs = await planRun(sql, client, options)
    console.log(
      `  ${slugs.length} slugs, ~${Math.round((slugs.length * 4.4) / 60)} min of crawling`,
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
