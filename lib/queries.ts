import { cache } from 'react'
import { itemLevelFor, levelBounds, rarityFor } from '@/engine'
import type { AchievementProgressInput, CharacterClass, Rarity } from '@/engine/types'
import { db } from '@/lib/db'

/**
 * Every public read goes through here, and therefore through the server.
 *
 * The guarantee is not "RLS refuses" but "no client ever touches the database".
 * Nothing in this file may become a client module.
 */

export interface EquipmentPiece {
  slug: string
  name: string
  website: string | null
  iconUrl: string | null
  mrrUsd: number
  /** Null when the product has no recurring revenue. */
  itemLevel: number | null
  rarity: Rarity
  vcFunded: boolean
  /** Everything below exists only to fill the item tooltip. */
  description: string | null
  category: string | null
  country: string | null
  pricingModel: string | null
  foundedDate: string | null
  last30dUsd: number
  customers: number | null
  domainRating: number | null
  /** techStack slugs, shown as an item's enchantments. */
  stack: string[]
}

/** The eight-stat panel, the shape the reference armory reads as. */
export interface SheetStats {
  last30dUsd: number
  arpu: number | null
  growthMrr30d: number | null
  domainRating: number | null
  followers: number | null
  /** Years since the earliest product launch. */
  age: number | null
  customers: number | null
  retention: number | null
}

/** What the ladder position actually means, rather than a bare ordinal. */
export interface RankContext {
  rank: number
  total: number
  percentile: number
  classRank: number
  classTotal: number
  above: { handle: string; level: number; mrrUsd: number } | null
  below: { handle: string; level: number; mrrUsd: number } | null
}

/** One point per day, for the sparkline and the "since" line. */
export interface HistoryPoint {
  day: string
  mrrUsd: number
  revenueTotalUsd: number
}

export interface CharacterPage {
  handle: string
  displayName: string
  avatarUrl: string | null
  claimed: boolean
  level: number
  ilvl: number | null
  ilvlDelta: number | null
  characterClass: CharacterClass
  rarity: Rarity
  xp: number
  nProducts: number
  mrrUsd: number
  revenueTotalUsd: number
  rank: number
  rankContext: RankContext | null
  stats: SheetStats
  history: HistoryPoint[]
  progress: { current: number; next: number | null; ratio: number }
  achievements: { code: string; earnedOn: string }[]
  equipment: EquipmentPiece[]
  cofounders: string[]
  /** The live numbers every locked achievement measures itself against. */
  progressInput: AchievementProgressInput
  /** Drives the OG image variant. */
  recentLevelUp: { level: number; at: string } | null
  recentAchievement: { code: string; earnedOn: string } | null
}

interface CharacterRow {
  handle: string
  display_name: string | null
  avatar_url: string | null
  claimed_at: string | null
  first_seen_at: string
  xp: string
  level: number
  ilvl: number | null
  class: string
  n_products: number
  mrr_cents: string
  revenue_total_cents: string
  customers: number
  active_subscriptions: number
  growth_mrr_30d: string | null
  previous_level: number | null
  leveled_at: string | null
}

/**
 * Returns null if the sheet does not exist or the founder opted out.
 *
 * Wrapped in React's `cache` because Next renders `generateMetadata` and the
 * page body of the same route concurrently, and both need the sheet. Without
 * it every character page reads the database twice for one visitor.
 */
export const getCharacter = cache(async (rawHandle: string): Promise<CharacterPage | null> => {
  const sql = db()
  const handle = rawHandle.replace(/^@/, '').toLowerCase()

  const [row] = await sql<CharacterRow[]>`
    select c.handle, f.display_name, f.avatar_url, f.claimed_at, f.first_seen_at,
           c.xp, c.level, c.ilvl, c.class,
           c.n_products, c.mrr_cents, c.revenue_total_cents,
           c.customers, c.active_subscriptions, c.growth_mrr_30d,
           c.previous_level, c.leveled_at
    from characters c
    join founders f on f.handle = c.handle
    where c.handle = ${handle}
      and f.opted_out_at is null
  `
  if (!row) return null

  const [achievements, products, rankRow, edges, historyRows, followerRow] = await Promise.all([
    sql<{ code: string; earned_on: string }[]>`
      select code, earned_on from character_achievements
      where handle = ${handle}
      order by earned_on desc, code
    `,
    sql<
      {
        slug: string
        name: string | null
        website: string | null
        icon_url: string | null
        funding_status: string | null
        mrr_cents: string | null
        last30d_cents: string | null
        customers: number | null
        domain_rating: number | null
        // postgres.js hands back a Date for a `date` column, not a string.
        founded_date: Date | string | null
        raw: Record<string, unknown> | null
      }[]
    >`
      -- Through founder_startups, not startups.founder_handle: a cofounded
      -- product counts in n_products and must therefore show up as gear.
      --
      -- The raw payload comes along because the tooltip is built from fields
      -- nothing extracts into a column: description, category, country,
      -- pricing model, tech stack.
      select s.slug, s.name, s.website, s.icon_url, s.funding_status,
             snap.mrr_cents, snap.last30d_cents, snap.customers,
             snap.domain_rating, snap.founded_date, snap.raw
      from founder_startups fs
      join startups s on s.slug = fs.startup_slug
      left join lateral (
        select mrr_cents, last30d_cents, customers, domain_rating, founded_date, raw
        from snapshots
        where startup_slug = s.slug
        order by captured_on desc limit 1
      ) snap on true
      where fs.handle = ${handle}
      order by snap.mrr_cents desc nulls last
    `,
    /*
     * Rank, class rank, total, and the two neighbours — one pass.
     *
     * "#14" on its own is inert. "3rd of 18 Paladins" is a position somebody
     * can actually hold, and the founder immediately above is a target rather
     * than a statistic.
     */
    sql<
      {
        rank: string
        total: string
        class_rank: string
        class_total: string
        above_handle: string | null
        above_level: number | null
        above_mrr: string | null
        below_handle: string | null
        below_level: number | null
        below_mrr: string | null
      }[]
    >`
      with ranked as (
        select c.handle, c.class, c.level, c.mrr_cents,
               row_number() over w                                as rank,
               row_number() over (partition by c.class order by
                 c.level desc, c.ilvl desc nulls last, c.handle)  as class_rank,
               lag(c.handle)     over w as above_handle,
               lag(c.level)      over w as above_level,
               lag(c.mrr_cents)  over w as above_mrr,
               lead(c.handle)    over w as below_handle,
               lead(c.level)     over w as below_level,
               lead(c.mrr_cents) over w as below_mrr
        from characters c
        join founders f on f.handle = c.handle
        where f.opted_out_at is null
        window w as (order by c.level desc, c.ilvl desc nulls last, c.handle)
      )
      select r.rank, r.class_rank,
             (select count(*) from ranked)                          as total,
             (select count(*) from ranked x where x.class = r.class) as class_total,
             r.above_handle, r.above_level, r.above_mrr,
             r.below_handle, r.below_level, r.below_mrr
      from ranked r
      where r.handle = ${handle}
    `,
    sql<{ other: string }[]>`
      select case when a_handle = ${handle} then b_handle else a_handle end as other
      from cofounder_edges
      where a_handle = ${handle} or b_handle = ${handle}
    `,
    /*
     * The daily series, summed across the founder's products.
     *
     * This is the one thing on the sheet a clone cannot copy: the snapshots
     * accumulate and nobody can backfill them. Today it is two days deep and
     * shows almost nothing, which is exactly why the read path exists now —
     * every day it does not is a day of history lost for good.
     */
    sql<{ day: string; mrr: string | null; total: string | null }[]>`
      select sn.captured_on::text as day,
             sum(sn.mrr_cents)           as mrr,
             sum(sn.revenue_total_cents) as total
      from founder_startups fs
      join snapshots sn on sn.startup_slug = fs.startup_slug
      where fs.handle = ${handle}
      group by sn.captured_on
      order by sn.captured_on
    `,
    sql<{ followers: number | null }[]>`
      select max((sn.raw ->> 'xFollowerCount')::int) as followers
      from founder_startups fs
      join lateral (
        select raw from snapshots where startup_slug = fs.startup_slug
        order by captured_on desc limit 1
      ) sn on true
      where fs.handle = ${handle}
    `,
  ])

  const level = row.level
  const mrrUsd = Number(row.mrr_cents) / 100
  const revenueTotalUsd = Number(row.revenue_total_cents) / 100
  const customers = row.customers
  const activeSubscriptions = row.active_subscriptions
  const growthMrr30d = row.growth_mrr_30d === null ? null : Number(row.growth_mrr_30d)
  const hasRetentionSignal = customers > 0
  const retention = hasRetentionSignal ? Math.min(activeSubscriptions / customers, 1) : 0
  const domainRating = maxOf(products.map((p) => p.domain_rating))
  const last30dUsd = products.reduce((sum, p) => sum + Number(p.last30d_cents ?? 0) / 100, 0)
  const earliest = products
    .map((p) => asDay(p.founded_date))
    .filter(isText)
    .sort()[0]
  // Size the business off subscriptions when `customers` is missing, exactly as
  // the engine does — otherwise ARPU divides by a zero TrustMRR reports on most
  // listings.
  const effectiveCustomers = customers > 0 ? customers : activeSubscriptions
  const rankRowOne = rankRow[0]
  const { current, next } = levelBounds(level)
  const xp = Number(row.xp)

  const sevenDaysAgo = Date.now() - 7 * 864e5
  const leveledAt = row.leveled_at
  const leveledRecently = leveledAt !== null && new Date(leveledAt).getTime() > sevenDaysAgo
  /**
   * Backfill is not news.
   *
   * Every achievement is retroactive, so the first compute for a founder stamps
   * all of them with today's date. Treating those as "just earned" made every
   * single OG image show an achievement toast on day one. An achievement only
   * counts as an event if it landed after we already knew the founder.
   */
  const knownSince = new Date(row.first_seen_at).getTime()
  const freshAchievement = achievements.find((a) => {
    const earned = new Date(a.earned_on).getTime()
    return earned > sevenDaysAgo && earned > knownSince
  })

  return {
    handle: row.handle,
    // xFounderName when TrustMRR has it, the handle otherwise.
    displayName: row.display_name ?? row.handle,
    avatarUrl: row.avatar_url,
    claimed: row.claimed_at !== null,
    level,
    ilvl: row.ilvl,
    ilvlDelta: row.ilvl === null ? null : row.ilvl - level,
    characterClass: row.class as CharacterClass,
    rarity: rarityFor(level),
    xp,
    nProducts: row.n_products,
    mrrUsd,
    revenueTotalUsd,
    rank: Number(rankRowOne?.rank ?? 0),
    rankContext: rankRowOne
      ? {
          rank: Number(rankRowOne.rank),
          total: Number(rankRowOne.total),
          percentile: Math.max(
            1,
            Math.round((Number(rankRowOne.rank) / Number(rankRowOne.total)) * 100),
          ),
          classRank: Number(rankRowOne.class_rank),
          classTotal: Number(rankRowOne.class_total),
          above: rankRowOne.above_handle
            ? {
                handle: rankRowOne.above_handle,
                level: rankRowOne.above_level ?? 0,
                mrrUsd: Number(rankRowOne.above_mrr ?? 0) / 100,
              }
            : null,
          below: rankRowOne.below_handle
            ? {
                handle: rankRowOne.below_handle,
                level: rankRowOne.below_level ?? 0,
                mrrUsd: Number(rankRowOne.below_mrr ?? 0) / 100,
              }
            : null,
        }
      : null,
    stats: {
      last30dUsd,
      arpu: effectiveCustomers > 0 ? mrrUsd / effectiveCustomers : null,
      growthMrr30d,
      domainRating,
      followers: followerRow[0]?.followers ?? null,
      age: earliest ? (Date.now() - new Date(earliest).getTime()) / (365.25 * 864e5) : null,
      customers: customers > 0 ? customers : null,
      retention: hasRetentionSignal ? retention : null,
    },
    history: historyRows.map((h) => ({
      day: h.day,
      mrrUsd: Number(h.mrr ?? 0) / 100,
      revenueTotalUsd: Number(h.total ?? 0) / 100,
    })),
    progressInput: {
      revenueTotalUsd,
      mrrUsd,
      customers,
      activeSubscriptions,
      nProducts: row.n_products,
      retention,
      hasRetentionSignal,
      growthMrr30d: growthMrr30d ?? 0,
      domainRating,
      level,
      cofounders: edges.length,
    },
    progress: {
      current,
      next,
      ratio: next === null ? 1 : Math.min(Math.max((xp - current) / (next - current), 0), 1),
    },
    achievements: achievements.map((a) => ({ code: a.code, earnedOn: a.earned_on })),
    equipment: products.map((p) => {
      const productMrr = Number(p.mrr_cents ?? 0) / 100
      const itemLevel = itemLevelFor(productMrr)
      const raw = (p.raw ?? {}) as Record<string, unknown>
      const insights = (raw.startupInsights ?? {}) as Record<string, unknown>
      return {
        slug: p.slug,
        name: p.name ?? p.slug,
        website: p.website,
        iconUrl: p.icon_url,
        mrrUsd: productMrr,
        itemLevel,
        rarity: rarityFor(itemLevel ?? 1),
        vcFunded: p.funding_status === 'vc-funded',
        description: asText(raw.description),
        category: asText(raw.category),
        country: asText(raw.country),
        pricingModel: asText(insights.pricingModel),
        foundedDate: asDay(p.founded_date),
        last30dUsd: Number(p.last30d_cents ?? 0) / 100,
        customers: p.customers,
        domainRating: p.domain_rating,
        stack: Array.isArray(raw.techStack)
          ? (raw.techStack as { slug?: string }[]).map((t) => t?.slug).filter(isText)
          : [],
      }
    }),
    cofounders: edges.map((e) => e.other),
    recentLevelUp: leveledRecently ? { level, at: leveledAt } : null,
    recentAchievement: freshAchievement
      ? { code: freshAchievement.code, earnedOn: freshAchievement.earned_on }
      : null,
  }
})

export interface LadderRow {
  rank: number
  handle: string
  level: number
  ilvl: number | null
  characterClass: CharacterClass
  /** Quality colour of the level — nearly constant near the top of the ladder. */
  rarity: Rarity
  /**
   * Quality colour of the iLvl, which is the one that actually varies here.
   * Level rarity paints the whole top 100 in two colours and the top 20 in one;
   * iLvl rarity spreads it across five. Gear score is what an armory ladder
   * compares anyway.
   */
  ilvlRarity: Rarity | null
  nProducts: number
}

/**
 * Top 100 by level, then by iLvl on a tie.
 *
 * No bottom rankings, ever: we show a top, never the floor. WoW never showed a
 * leaderboard of the worst players.
 */
export async function getLadder(characterClass?: string): Promise<LadderRow[]> {
  const sql = db()
  const rows = await sql<
    { handle: string; level: number; ilvl: number | null; class: string; n_products: number }[]
  >`
    select c.handle, c.level, c.ilvl, c.class, c.n_products
    from characters c
    join founders f on f.handle = c.handle
    where f.opted_out_at is null
      ${characterClass ? sql`and c.class = ${characterClass}` : sql``}
    -- nulls last: no recurring revenue is "not measured", never "worst".
    order by c.level desc, c.ilvl desc nulls last, c.handle
    limit 100
  `
  return rows.map((row, index) => ({
    rank: index + 1,
    handle: row.handle,
    level: row.level,
    ilvl: row.ilvl,
    characterClass: row.class as CharacterClass,
    rarity: rarityFor(row.level),
    ilvlRarity: row.ilvl === null ? null : rarityFor(row.ilvl),
    nProducts: row.n_products,
  }))
}

/**
 * When the engine last ran. Cached because the footer asks on every page.
 * Everything on this site is a nightly snapshot, and a number with no date on
 * it invites people to read it as live.
 */
export const getLastComputedAt = cache(async (): Promise<string | null> => {
  const sql = db()
  const [row] = await sql<{ at: string | null }[]>`
    select max(computed_at)::text as at from characters
  `
  return row?.at ?? null
})

/**
 * Handles that belong in the sitemap.
 *
 * Claimed only, and that is the whole point: an unclaimed sheet is `noindex`,
 * so listing it here would be asking search engines to crawl a page that tells
 * them to go away. The rule the spec cares about — nobody is indexed until they
 * ask to be — has to hold in both places or it holds in neither.
 */
export const getIndexableHandles = cache(
  async (): Promise<{ handle: string; updatedAt: string }[]> => {
    const sql = db()
    const rows = await sql<{ handle: string; at: string }[]>`
      select c.handle, c.computed_at::text as at
      from characters c
      join founders f on f.handle = c.handle
      where f.opted_out_at is null
        and f.claimed_at is not null
      order by c.level desc
      limit 5000
    `
    return rows.map((r) => ({ handle: r.handle, updatedAt: r.at }))
  },
)

export interface RealmStats {
  characters: number
  maxLevel: number
  trackedMrrUsd: number
  products: number
  achievements: number
}

/**
 * The realm status line — a server population readout, not a marketing claim.
 * Every number here is countable and falsifiable, which is the whole point.
 */
export async function getRealmStats(): Promise<RealmStats> {
  const sql = db()
  const [row] = await sql<
    {
      characters: number
      max_level: number | null
      mrr_cents: string | null
      products: string | null
      achievements: string | null
    }[]
  >`
    select
      (select count(*)::int from characters c
        join founders f on f.handle = c.handle where f.opted_out_at is null) as characters,
      (select max(level) from characters)                                    as max_level,
      (select sum(mrr_cents) from characters)                                as mrr_cents,
      (select count(*) from startups)                                        as products,
      (select count(*) from character_achievements)                          as achievements
  `
  return {
    characters: row?.characters ?? 0,
    maxLevel: row?.max_level ?? 0,
    trackedMrrUsd: Number(row?.mrr_cents ?? 0) / 100,
    products: Number(row?.products ?? 0),
    achievements: Number(row?.achievements ?? 0),
  }
}

/** Class names, each with how many characters carry it. */
export async function getClassCounts(): Promise<{ name: string; count: number }[]> {
  const sql = db()
  const rows = await sql<{ class: string; n: number }[]>`
    select c.class, count(*)::int as n
    from characters c
    join founders f on f.handle = c.handle
    where f.opted_out_at is null
    group by c.class
    order by n desc, c.class
  `
  return rows.map((r) => ({ name: r.class, count: r.n }))
}

export async function getClasses(): Promise<string[]> {
  const sql = db()
  const rows = await sql<{ class: string }[]>`
    select distinct class from characters order by class
  `
  return rows.map((r) => r.class)
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

/** `date` columns arrive as Date objects; everything downstream wants a day. */
const asDay = (v: Date | string | null): string | null => {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return isText(v) ? v.slice(0, 10) : null
}
const asText = (v: unknown): string | null => (isText(v) ? v : null)
const maxOf = (values: (number | null)[]): number | null => {
  const present = values.filter((v): v is number => v !== null)
  return present.length ? Math.max(...present) : null
}
