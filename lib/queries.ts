import { cache } from 'react'
import { itemLevelFor, levelBounds, rarityFor } from '@/engine'
import type { CharacterClass, Rarity } from '@/engine/types'
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
  itemLevel: number
  rarity: Rarity
  vcFunded: boolean
}

export interface CharacterPage {
  handle: string
  displayName: string
  avatarUrl: string | null
  claimed: boolean
  level: number
  ilvl: number
  ilvlDelta: number
  characterClass: CharacterClass
  rarity: Rarity
  xp: number
  nProducts: number
  mrrUsd: number
  revenueTotalUsd: number
  rank: number
  progress: { current: number; next: number | null; ratio: number }
  achievements: { code: string; earnedOn: string }[]
  equipment: EquipmentPiece[]
  cofounders: string[]
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
  ilvl: number
  class: string
  n_products: number
  mrr_cents: string
  revenue_total_cents: string
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
           c.previous_level, c.leveled_at
    from characters c
    join founders f on f.handle = c.handle
    where c.handle = ${handle}
      and f.opted_out_at is null
  `
  if (!row) return null

  const [achievements, products, rankRow, edges] = await Promise.all([
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
      }[]
    >`
      -- Through founder_startups, not startups.founder_handle: a cofounded
      -- product counts in n_products and must therefore show up as gear.
      select s.slug, s.name, s.website, s.icon_url, s.funding_status, snap.mrr_cents
      from founder_startups fs
      join startups s on s.slug = fs.startup_slug
      left join lateral (
        select mrr_cents from snapshots
        where startup_slug = s.slug
        order by captured_on desc limit 1
      ) snap on true
      where fs.handle = ${handle}
      order by snap.mrr_cents desc nulls last
    `,
    sql<{ rank: string }[]>`
      select count(*) + 1 as rank from characters
      where (level, ilvl) > (${row.level}, ${row.ilvl})
    `,
    sql<{ other: string }[]>`
      select case when a_handle = ${handle} then b_handle else a_handle end as other
      from cofounder_edges
      where a_handle = ${handle} or b_handle = ${handle}
    `,
  ])

  const level = row.level
  const mrrUsd = Number(row.mrr_cents) / 100
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
    ilvlDelta: row.ilvl - level,
    characterClass: row.class as CharacterClass,
    rarity: rarityFor(level),
    xp,
    nProducts: row.n_products,
    mrrUsd,
    revenueTotalUsd: Number(row.revenue_total_cents) / 100,
    rank: Number(rankRow[0]?.rank ?? 0),
    progress: {
      current,
      next,
      ratio: next === null ? 1 : Math.min(Math.max((xp - current) / (next - current), 0), 1),
    },
    achievements: achievements.map((a) => ({ code: a.code, earnedOn: a.earned_on })),
    equipment: products.map((p) => {
      const productMrr = Number(p.mrr_cents ?? 0) / 100
      const itemLevel = itemLevelFor(productMrr)
      return {
        slug: p.slug,
        name: p.name ?? p.slug,
        website: p.website,
        iconUrl: p.icon_url,
        mrrUsd: productMrr,
        itemLevel,
        rarity: rarityFor(itemLevel),
        vcFunded: p.funding_status === 'vc-funded',
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
  ilvl: number
  characterClass: CharacterClass
  rarity: Rarity
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
    { handle: string; level: number; ilvl: number; class: string; n_products: number }[]
  >`
    select c.handle, c.level, c.ilvl, c.class, c.n_products
    from characters c
    join founders f on f.handle = c.handle
    where f.opted_out_at is null
      ${characterClass ? sql`and c.class = ${characterClass}` : sql``}
    order by c.level desc, c.ilvl desc, c.handle
    limit 100
  `
  return rows.map((row, index) => ({
    rank: index + 1,
    handle: row.handle,
    level: row.level,
    ilvl: row.ilvl,
    characterClass: row.class as CharacterClass,
    rarity: rarityFor(row.level),
    nProducts: row.n_products,
  }))
}

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
