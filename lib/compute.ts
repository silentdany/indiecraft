import type postgres from 'postgres'
import { aggregateFounder, computeCharacter } from '@/engine'
import { FUNDING_POLICY } from '@/engine/tuning'
import type { ProductInput } from '@/engine/types'
import { normalizeRealm } from '@/lib/realm'
import { centsToUsd, normalizeHandle, type TrustmrrStartup } from '@/lib/trustmrr'

/**
 * The server-side plumbing around the engine.
 *
 * Reads each startup's latest snapshot, aggregates by founder, calls the (pure)
 * engine, writes the result. Fast, because everything is already in the
 * database — which is why this is the only step that stays on Vercel Cron.
 */

export interface ComputeReport {
  startups: number
  founders: number
  achievementsGranted: number
  edges: number
  durationMs: number
}

interface SnapshotRow {
  startup_slug: string
  raw: TrustmrrStartup
  mrr_cents: string | null
  revenue_total_cents: string | null
  customers: number | null
  active_subscriptions: number | null
  growth_mrr_30d: string | null
  domain_rating: number | null
  visitors_30d: number | null
  funding_status: string | null
  founded_date: string | null
  founder_handle: string | null
}

export async function computeAll(sql: postgres.Sql): Promise<ComputeReport> {
  const startedAt = Date.now()

  // Latest known state of every startup, across all sources.
  const rows = await sql<SnapshotRow[]>`
    select distinct on (source, startup_slug)
      startup_slug, raw, mrr_cents, revenue_total_cents, customers,
      active_subscriptions, growth_mrr_30d, domain_rating, visitors_30d,
      funding_status, founded_date, founder_handle
    from snapshots
    order by source, startup_slug, captured_on desc
  `

  const usable = rows.filter(
    (row) => FUNDING_POLICY !== 'exclude' || row.funding_status !== 'vc-funded',
  )

  // A product belongs to its founder AND to its cofounders. That is what makes
  // the guild graph something other than decoration.
  const byFounder = new Map<string, ProductInput[]>()
  // Key `a|b` to deduplicate, value is the pair itself so we never reparse it.
  const edges = new Map<string, [string, string]>()
  // Name and face, taken from whichever listing the founder actually owns.
  const identities = new Map<string, { name: string | null; avatar: string | null }>()
  // Who owns what, so the gear list and n_products can never disagree.
  const ownership: { handle: string; slug: string; role: 'founder' | 'cofounder' }[] = []

  for (const row of usable) {
    const product = toProduct(row)
    const owner = normalizeHandle(row.founder_handle ?? row.raw?.xHandle)
    const contributors = [...new Set([owner, ...product.cofounders].filter(isHandle))]

    // Only the listing's own xHandle carries that person's name and picture;
    // a cofounder's identity comes from their own listing, never this one.
    if (owner && !identities.has(owner)) {
      identities.set(owner, {
        name: row.raw?.xFounderName ?? null,
        avatar: row.raw?.xProfilePicture ?? null,
      })
    }

    for (const handle of contributors) {
      const list = byFounder.get(handle) ?? []
      list.push(product)
      byFounder.set(handle, list)
      ownership.push({
        handle,
        slug: product.slug,
        role: handle === owner ? 'founder' : 'cofounder',
      })
    }
    for (const pair of pairs(contributors)) edges.set(pair.join('|'), pair)
  }

  const sheets = [...byFounder].map(([handle, products]) =>
    computeCharacter(aggregateFounder(handle, products)),
  )

  let achievementsGranted = 0

  await sql.begin(async (tx) => {
    // Rebuild `startups` from the snapshots.
    //
    // The schema calls this table "rebuildable from snapshots", and until now
    // that was aspiration rather than fact: only the crawler ever wrote to it,
    // so a `schema:apply --reset` emptied it and nothing put it back until the
    // next nightly run. Every gear list went blank while the sheets kept
    // claiming "1 product" beside them — the exact self-contradiction
    // founder_startups exists to prevent.
    //
    // first_seen_at and last_seen_at are deliberately left alone on conflict:
    // when a slug was first and last seen is the crawler's business, not this
    // step's.
    const startupRows = usable.map((row) => ({
      slug: row.startup_slug,
      name: row.raw?.name ?? null,
      website: row.raw?.website ?? null,
      icon_url: row.raw?.icon ?? null,
      founder_handle: normalizeHandle(row.founder_handle ?? row.raw?.xHandle),
      funding_status: row.funding_status,
    }))
    if (startupRows.length > 0) {
      await tx`
        insert into startups ${tx(
          startupRows,
          'slug',
          'name',
          'website',
          'icon_url',
          'founder_handle',
          'funding_status',
        )}
        on conflict (slug) do update set
          name           = excluded.name,
          website        = excluded.website,
          icon_url       = excluded.icon_url,
          founder_handle = excluded.founder_handle,
          funding_status = excluded.funding_status
      `
    }

    /*
     * Batched, not one founder at a time.
     *
     * The achievements insert below already carried the note that a per-code
     * loop was "ruinous over a network hop" — and the two statements around it
     * were still doing exactly that per FOUNDER. At 144 founders that is 7.7
     * seconds and invisible. Discovering the other 97% of TrustMRR takes the
     * corpus to a few thousand, where three round trips each is four minutes
     * against a 300-second function ceiling: a cliff nobody would see coming
     * until the night it fell off.
     *
     * Chunked at 1,000 rows because Postgres allows 65,535 bind parameters per
     * statement, and `characters` binds thirteen columns — 5,000 founders in
     * one statement is 65,000 and the failure would arrive exactly when the
     * corpus got interesting.
     */
    const founderRows = sheets.map((sheet) => {
      // xFounderName and xProfilePicture give a real name and a real face —
      // both absent from the spec, both present in every live response.
      const identity = identities.get(sheet.handle)
      return {
        handle: sheet.handle,
        display_name: identity?.name ?? null,
        avatar_url: identity?.avatar ?? null,
      }
    })

    for (const rows of chunk(founderRows, 1000)) {
      await tx`
        insert into founders ${tx(rows, 'handle', 'display_name', 'avatar_url')}
        on conflict (handle) do update set
          display_name = coalesce(excluded.display_name, founders.display_name),
          avatar_url   = coalesce(excluded.avatar_url, founders.avatar_url)
      `
    }

    const characterRows = sheets.map((sheet) => {
      const aggregate = aggregateFounder(sheet.handle, byFounder.get(sheet.handle) ?? [])
      return {
        handle: sheet.handle,
        xp: sheet.xp,
        level: sheet.level,
        ilvl: sheet.ilvl,
        class: sheet.class,
        realm: sheet.realm,
        faction: sheet.faction,
        n_products: sheet.nProducts,
        mrr_cents: Math.round(aggregate.mrrUsd * 100),
        revenue_total_cents: Math.round(aggregate.revenueTotalUsd * 100),
        customers: aggregate.customers,
        active_subscriptions: aggregate.activeSubscriptions,
        growth_mrr_30d: aggregate.growthMrr30d,
      }
    })

    // previous_level / leveled_at only move on a real level-up: that is what
    // drives the "DING!" variant of the OG image. The CASE reads `excluded`
    // against the existing row, which holds per-row inside a multi-row insert
    // exactly as it did one at a time.
    for (const rows of chunk(characterRows, 1000)) {
      await tx`
        insert into characters ${tx(
          rows,
          'handle',
          'xp',
          'level',
          'ilvl',
          'class',
          'realm',
          'faction',
          'n_products',
          'mrr_cents',
          'revenue_total_cents',
          'customers',
          'active_subscriptions',
          'growth_mrr_30d',
        )}
        on conflict (handle) do update set
          xp = excluded.xp,
          level = excluded.level,
          ilvl = excluded.ilvl,
          class = excluded.class,
          realm = excluded.realm,
          faction = excluded.faction,
          n_products = excluded.n_products,
          mrr_cents = excluded.mrr_cents,
          revenue_total_cents = excluded.revenue_total_cents,
          customers = excluded.customers,
          active_subscriptions = excluded.active_subscriptions,
          growth_mrr_30d = excluded.growth_mrr_30d,
          previous_level = case
            when excluded.level > characters.level then characters.level
            else characters.previous_level end,
          leveled_at = case
            when excluded.level > characters.level then now()
            else characters.leveled_at end,
          computed_at = now()
      `
    }

    // Append-only: an earned achievement is never lost, even if the condition
    // becomes false again. Hence do nothing — never a delete.
    const achievementRows = sheets.flatMap((sheet) =>
      sheet.achievements.map((code) => ({ handle: sheet.handle, code })),
    )
    for (const rows of chunk(achievementRows, 1000)) {
      const result = await tx`
        insert into character_achievements ${tx(rows, 'handle', 'code')}
        on conflict (handle, code) do nothing
      `
      achievementsGranted += result.count
    }

    // Both of these are one statement each, for the same reason as above.
    if (ownership.length > 0) {
      const rows = ownership.map((o) => ({ handle: o.handle, startup_slug: o.slug, role: o.role }))
      await tx`
        insert into founder_startups ${tx(rows, 'handle', 'startup_slug', 'role')}
        on conflict (handle, startup_slug) do update set role = excluded.role
      `
    }

    if (edges.size > 0) {
      const rows = [...edges.values()].map(([a, b]) => ({ a_handle: a, b_handle: b }))
      await tx`
        insert into cofounder_edges ${tx(rows, 'a_handle', 'b_handle')}
        on conflict do nothing
      `
    }

    /*
     * Today's standing, one row per founder.
     *
     * This runs last among the writes because it reads `characters` after every
     * sheet in this batch has landed — the rank is computed over the finished
     * ladder, not over a half-written one.
     *
     * `on conflict do update` rather than `do nothing`: a second compute on the
     * same day should correct the day's row, not preserve whatever the first
     * partial run happened to write. The day is the unit, not the run.
     *
     * Opted-out founders are excluded from the ranking AND from the table. A
     * daily record of somebody who asked to be gone is exactly the kind of
     * quiet retention this project exists not to do.
     */
    await tx`
      insert into character_days (handle, captured_on, rank, level, ilvl, mrr_cents)
      select c.handle, current_date,
             row_number() over (order by c.level desc, c.ilvl desc nulls last, c.handle),
             c.level, c.ilvl, c.mrr_cents
      from characters c
      join founders f on f.handle = c.handle
      where f.opted_out_at is null
      on conflict (handle, captured_on) do update set
        rank      = excluded.rank,
        level     = excluded.level,
        ilvl      = excluded.ilvl,
        mrr_cents = excluded.mrr_cents
    `

    // Last, and load-bearing: replay what people asked for on top of what we
    // crawled. opted_out_at and claimed_at are the only two values here that no
    // amount of crawling can reconstruct, and the insert above resets neither —
    // but a `schema:apply --reset` drops the whole founders table. This replay
    // is what makes that safe. Remove it and the next reset silently
    // republishes every sheet somebody asked to remove.
    await tx`
      update founders f set
        opted_out_at = e.opted_out_at,
        claimed_at   = e.claimed_at
      from (
        select handle,
               min(occurred_at) filter (where action = 'opt_out') as opted_out_at,
               min(occurred_at) filter (where action = 'claim')   as claimed_at
        from consent_events
        group by handle
      ) e
      where e.handle = f.handle
    `
  })

  return {
    startups: usable.length,
    founders: sheets.length,
    achievementsGranted,
    edges: edges.size,
    durationMs: Date.now() - startedAt,
  }
}

function toProduct(row: SnapshotRow): ProductInput {
  const raw = row.raw ?? ({} as TrustmrrStartup)
  return {
    slug: row.startup_slug,
    name: raw.name ?? null,
    iconUrl: raw.icon ?? null,
    revenueTotalUsd: centsToUsd(Number(row.revenue_total_cents ?? 0)),
    mrrUsd: centsToUsd(Number(row.mrr_cents ?? 0)),
    customers: row.customers ?? 0,
    activeSubscriptions: row.active_subscriptions ?? 0,
    growthMrr30d: row.growth_mrr_30d === null ? null : Number(row.growth_mrr_30d),
    domainRating: row.domain_rating,
    visitors30d: row.visitors_30d,
    revenuePerVisitor: raw.revenuePerVisitor ?? null,
    foundedDate: row.founded_date,
    fundingStatus: row.funding_status,
    channels: (raw.marketingChannels ?? []).map((c) => c?.slug).filter(isString),
    stack: (raw.techStack ?? []).map((t) => t?.slug).filter(isString),
    cofounders: (raw.cofounders ?? []).map((c) => normalizeHandle(c?.xHandle)).filter(isHandle),
    country: normalizeRealm(raw.country),
    // startupInsights.businessType first, targetAudience as the fallback: they
    // answer the same question with the same three words, and the insight is
    // present on 65% of listings against the audience field's 55%. Taking
    // either one alone throws away founders the other would have placed.
    businessType: businessTypeOf(raw),
  }
}

function businessTypeOf(raw: TrustmrrStartup): string | null {
  const insight = raw.startupInsights?.businessType
  const audience = raw.targetAudience
  const value = isString(insight) ? insight : isString(audience) ? audience : null
  // 'Unknown' is a real value in the payload and it is not an answer.
  return value === 'Unknown' ? null : value
}

/**
 * Postgres binds at most 65,535 parameters per statement, and a `characters`
 * row costs thirteen of them. Chunking is what stops the corpus growing into a
 * hard failure.
 */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Every normalized pair a < b, for an undirected graph without duplicates. */
function pairs(handles: string[]): [string, string][] {
  const sorted = [...handles].sort()
  const out: [string, string][] = []
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) out.push([sorted[i]!, sorted[j]!])
  }
  return out
}

const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const isHandle = (value: string | null): value is string => value !== null
