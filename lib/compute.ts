import type postgres from 'postgres'
import { aggregateFounder, computeCharacter } from '@/engine'
import { FUNDING_POLICY } from '@/engine/tuning'
import type { ProductInput } from '@/engine/types'
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
    for (const sheet of sheets) {
      const products = byFounder.get(sheet.handle) ?? []
      const aggregate = aggregateFounder(sheet.handle, products)

      // xFounderName and xProfilePicture give a real name and a real face —
      // both absent from the spec, both present in every live response.
      const identity = identities.get(sheet.handle)
      await tx`
        insert into founders (handle, display_name, avatar_url)
        values (${sheet.handle}, ${identity?.name ?? null}, ${identity?.avatar ?? null})
        on conflict (handle) do update set
          display_name = coalesce(excluded.display_name, founders.display_name),
          avatar_url   = coalesce(excluded.avatar_url, founders.avatar_url)
      `

      // previous_level / leveled_at only move on a real level-up: that is what
      // drives the "DING!" variant of the OG image.
      await tx`
        insert into characters (
          handle, xp, level, ilvl, class, n_products, mrr_cents,
          revenue_total_cents, customers, active_subscriptions, growth_mrr_30d
        ) values (
          ${sheet.handle}, ${sheet.xp}, ${sheet.level}, ${sheet.ilvl}, ${sheet.class},
          ${sheet.nProducts}, ${Math.round(aggregate.mrrUsd * 100)},
          ${Math.round(aggregate.revenueTotalUsd * 100)}, ${aggregate.customers},
          ${aggregate.activeSubscriptions}, ${aggregate.growthMrr30d}
        )
        on conflict (handle) do update set
          xp = excluded.xp,
          level = excluded.level,
          ilvl = excluded.ilvl,
          class = excluded.class,
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

      // Append-only: an earned achievement is never lost, even if the condition
      // becomes false again. Hence do nothing — never a delete.
      //
      // One multi-row insert rather than one per code. A founder carries a
      // dozen achievements, so the loop was ~1,700 round trips across the
      // corpus — survivable on a local socket, ruinous over a network hop.
      if (sheet.achievements.length > 0) {
        const rows = sheet.achievements.map((code) => ({ handle: sheet.handle, code }))
        const result = await tx`
          insert into character_achievements ${tx(rows, 'handle', 'code')}
          on conflict (handle, code) do nothing
        `
        achievementsGranted += result.count
      }
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
  }
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
