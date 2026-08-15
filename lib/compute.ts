import type postgres from 'postgres'
import { aggregateFounder, computeCharacter } from '@/engine'
import { FUNDING_POLICY, REALM_FIRST_CODE, REALM_FIRST_MIN_SIZE } from '@/engine/tuning'
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
  /** Characters dropped because TrustMRR no longer lists any of their products. */
  charactersRemoved: number
  durationMs: number
}

/**
 * Refuse to prune when this run accounts for less than this share of the
 * characters already on record.
 *
 * Excluding delisted slugs means a bad reconciliation, an empty snapshot read
 * or a half-finished migration can all present as "these founders no longer
 * exist", and the prune below would act on it in one statement. Real attrition
 * is a handful a night; anything that looks like a cliff is a bug, and the
 * right response to a bug is to do nothing and say so.
 */
const PRUNE_MIN_SHARE = 0.5

/**
 * Exported for lib/queries.ts, which builds the same aggregate for one founder
 * so the sheet's paper doll is computed from the same numbers the ladder was.
 * `founder_handle` is only read by the fan-out below and stays optional for
 * that reason — a caller that already knows whose products these are has no
 * reason to select it.
 */
export interface SnapshotRow {
  startup_slug: string
  /**
   * Nullable, which the readers already assumed: `toProduct` falls back to an
   * empty object and every other access here goes through `?.`. The type said
   * otherwise and was simply wrong — a snapshot row can predate the payload.
   */
  raw: TrustmrrStartup | null
  mrr_cents: string | null
  last30d_cents: string | null
  revenue_total_cents: string | null
  customers: number | null
  active_subscriptions: number | null
  growth_mrr_30d: string | null
  domain_rating: number | null
  visitors_30d: number | null
  funding_status: string | null
  founded_date: string | null
  founder_handle?: string | null
}

export async function computeAll(sql: postgres.Sql): Promise<ComputeReport> {
  const startedAt = Date.now()

  /*
   * Latest known state of every startup TrustMRR still lists.
   *
   * The `delisted_at is null` clause is the one that keeps the site's promise
   * honest. Without it a founder who withdrew from TrustMRR kept a character
   * here forever, carrying their last known revenue, on the strength of a
   * public listing that no longer existed — which is the whole justification
   * for publishing any of this.
   *
   * A left join, not an inner one: a slug can have snapshots before `startups`
   * has a row for it, and treating "not yet reconciled" as "delisted" would
   * drop a startup for the crime of being new.
   */
  const rows = await sql<SnapshotRow[]>`
    select distinct on (s.source, s.startup_slug)
      s.startup_slug, s.raw, s.mrr_cents, s.last30d_cents, s.revenue_total_cents, s.customers,
      s.active_subscriptions, s.growth_mrr_30d, s.domain_rating, s.visitors_30d,
      s.funding_status, s.founded_date, s.founder_handle
    from snapshots s
    left join startups st on st.slug = s.startup_slug
    where st.delisted_at is null
    order by s.source, s.startup_slug, s.captured_on desc
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
  let charactersRemoved = 0

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
     * statement, and `characters` binds nineteen columns — 3,400 founders in
     * one statement would reach the ceiling, and the failure would arrive
     * exactly when the corpus got interesting.
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
        // Achievement progress only. Nothing below reaches a level or a rank.
        visitors_30d: aggregate.visitors30d,
        categories: aggregate.categories.length,
        stack_size: aggregate.stack.length,
        profit_margin_30d: aggregate.profitMargin30d,
        google_impressions_30d: aggregate.googleImpressions30d,
        products_earning: (byFounder.get(sheet.handle) ?? []).filter((p) => p.mrrUsd > 0).length,
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
          'visitors_30d',
          'categories',
          'stack_size',
          'profit_margin_30d',
          'google_impressions_30d',
          'products_earning',
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
          visitors_30d = excluded.visitors_30d,
          categories = excluded.categories,
          stack_size = excluded.stack_size,
          profit_margin_30d = excluded.profit_margin_30d,
          google_impressions_30d = excluded.google_impressions_30d,
          products_earning = excluded.products_earning,
          previous_level = case
            when excluded.level > characters.level then characters.level
            else characters.previous_level end,
          leveled_at = case
            when excluded.level > characters.level then now()
            else characters.leveled_at end,
          computed_at = now()
      `
    }

    /*
     * Drop characters whose products TrustMRR no longer lists.
     *
     * The upsert above can only ever add and update, so without this a founder
     * removed from the source keeps their sheet forever — which is the exact
     * failure the delisting work exists to fix, half-fixed. `characters` is
     * derived and rebuildable, so deleting from it costs nothing;
     * `character_achievements` hangs off `founders` rather than off this table,
     * so badges survive and come back with them if they relist.
     */
    const [existing] = await tx<{ n: number }[]>`select count(*)::int as n from characters`
    const before = existing?.n ?? 0
    const live = sheets.map((s) => s.handle)

    if (before > 0 && live.length < before * PRUNE_MIN_SHARE) {
      console.warn(
        `compute: ${live.length} founders against ${before} characters on record — ` +
          `below the ${PRUNE_MIN_SHARE * 100}% floor, refusing to prune.`,
      )
    } else {
      // founder_startups first: a delisted product must leave the gear list
      // even when its founder still has others and keeps their character.
      await tx`
        delete from founder_startups fs
        using startups st
        where st.slug = fs.startup_slug and st.delisted_at is not null
      `
      const pruned = await tx`delete from characters where not (handle = any(${live}))`
      charactersRemoved = pruned.count
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

    /*
     * Realm First!, the one achievement no `test` can decide.
     *
     * Every other badge is a property of one founder and is computed by the
     * pure engine. This one is a property of a RANKING: whether you are top of
     * your realm depends entirely on everybody else, so it has to run here,
     * after `characters` is written, in the same statement style as the ladder
     * above it.
     *
     * The floor is the whole design. Without it there are 73 winners, because
     * 54 realms hold exactly one founder — and being first on a realm of one is
     * a rounding error with a medal. At ten it is 19 realms, all contested.
     *
     * Append-only like every other achievement: whoever gets there first keeps
     * it when somebody overtakes them. That is a deliberate reading of "an
     * earned achievement is never lost" and it matches the game — a server
     * first is a historical fact, not a current standing.
     */
    const realmFirst = await tx`
      with sized as (
        select c.realm, count(*)::int as n
        from characters c
        join founders f on f.handle = c.handle
        where f.opted_out_at is null and c.realm is not null
        group by c.realm
        having count(*) >= ${REALM_FIRST_MIN_SIZE}
      )
      insert into character_achievements (handle, code)
      select distinct on (c.realm) c.handle, ${REALM_FIRST_CODE}
      from characters c
      join founders f on f.handle = c.handle
      join sized s on s.realm = c.realm
      where f.opted_out_at is null
      order by c.realm, c.level desc, c.ilvl desc nulls last, c.handle
      on conflict (handle, code) do nothing
    `
    achievementsGranted += realmFirst.count

    // Last, and load-bearing: replay what people asked for on top of what we
    // crawled. opted_out_at and claimed_at are the only two values here that no
    // amount of crawling can reconstruct, and the insert above resets neither —
    // but a `schema:apply --reset` drops the whole founders table. This replay
    // is what makes that safe. Remove it and the next reset silently
    // republishes every sheet somebody asked to remove.
    /*
     * The LATEST decision wins, not the first one.
     *
     * This used to take `min(occurred_at) filter (action = 'opt_out')`, which
     * made one accidental click permanent: any opt_out ever recorded meant
     * opted out forever, and the sheet 404s, so its owner could not even reach
     * the page to undo it. Somebody removed their own sheet by mistake within a
     * minute of claiming it and had no way back.
     *
     * Reading the most recent event instead makes removal reversible by exactly
     * one person — the one who can sign in as that handle — and nothing about
     * the safety property changes: a sheet whose last word was "remove" stays
     * removed, through resets and forever, until its owner says otherwise.
     *
     * Nothing is ever deleted from consent_events. The history stays whole; it
     * is only read differently.
     */
    await tx`
      with latest as (
        select distinct on (handle) handle, action, occurred_at
        from consent_events
        order by handle, occurred_at desc, id desc
      ),
      last_removal as (
        select handle, max(occurred_at) as at
        from consent_events where action = 'opt_out' group by handle
      ),
      -- The first claim that still stands: one made before a later removal was
      -- undone by that removal, so it does not count.
      standing_claim as (
        select c.handle, min(c.occurred_at) as at
        from consent_events c
        left join last_removal r on r.handle = c.handle
        where c.action = 'claim' and (r.at is null or c.occurred_at > r.at)
        group by c.handle
      )
      update founders f set
        opted_out_at = case when l.action = 'opt_out' then l.occurred_at else null end,
        claimed_at   = sc.at
      from latest l
      left join standing_claim sc on sc.handle = l.handle
      where l.handle = f.handle
    `
  })

  return {
    startups: usable.length,
    founders: sheets.length,
    achievementsGranted,
    charactersRemoved,
    edges: edges.size,
    durationMs: Date.now() - startedAt,
  }
}

/**
 * Snapshot row to engine input.
 *
 * Exported so the character sheet can reach the same aggregate this file feeds
 * the ladder. Duplicating the mapping there was the obvious alternative and the
 * wrong one: the two would drift on the first field anybody added, and the
 * symptom would be a paper doll quietly disagreeing with the stats panel above
 * it on the same page.
 */
export function toProduct(row: SnapshotRow): ProductInput {
  const raw = row.raw ?? ({} as TrustmrrStartup)
  return {
    slug: row.startup_slug,
    name: raw.name ?? null,
    iconUrl: raw.icon ?? null,
    revenueTotalUsd: centsToUsd(Number(row.revenue_total_cents ?? 0)),
    mrrUsd: centsToUsd(Number(row.mrr_cents ?? 0)),
    last30dUsd: centsToUsd(Number(row.last30d_cents ?? 0)),
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
    followers: numberOrNull(raw.xFollowerCount),
    country: normalizeRealm(raw.country),
    // startupInsights.businessType first, targetAudience as the fallback: they
    // answer the same question with the same three words, and the insight is
    // present on 65% of listings against the audience field's 55%. Taking
    // either one alone throws away founders the other would have placed.
    businessType: businessTypeOf(raw),
    category: raw.category ?? null,
    isMobileApp: raw.isMobileApp === true,
    profitMargin30d: numberOrNull(raw.profitMarginLast30Days),
    googleImpressions30d: numberOrNull(raw.googleSearchImpressionsLast30Days),
    listedForSaleAt: raw.firstListedForSaleAt ?? null,
  }
}

/** Guards against the API sending a numeric field as a string or as NaN. */
function numberOrNull(value: unknown): number | null {
  const n = Number(value)
  return value === null || value === undefined || Number.isNaN(n) ? null : n
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
