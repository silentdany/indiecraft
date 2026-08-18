import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import {
  ACHIEVEMENTS_BY_CODE,
  aggregateFounder,
  equipmentFor,
  equipmentInput,
  equipmentScore,
  levelBounds,
  RARITY_BY_NAME,
  rarityFor,
  scoreOnSlot,
} from '@/engine'
import type {
  AchievementProgressInput,
  CharacterClass,
  EquippedSlot,
  Faction,
  Rarity,
} from '@/engine/types'
import { toProduct } from '@/lib/compute'
import { db } from '@/lib/db'
import { normalizeRealm } from '@/lib/realm'
import type { TrustmrrStartup } from '@/lib/trustmrr'

/**
 * Every public read goes through here, and therefore through the server.
 *
 * The guarantee is not "RLS refuses" but "no client ever touches the database".
 * Nothing in this file may become a client module.
 */

/**
 * The tag every cached read here carries, and the one /api/cron/compute
 * invalidates the moment new data lands.
 *
 * One tag, not one per query: `characters` is rewritten wholesale by a single
 * nightly job, so there is no such thing as the ladder being fresh while the
 * class counts are stale. A finer set of tags would only be more ways to
 * forget one.
 */
export const CORPUS_TAG = 'corpus'

/**
 * Cache a read of the corpus.
 *
 * /ladder and /compare take searchParams, which makes Next render them
 * dynamically — their `revalidate` never applied and every visit re-ran every
 * query. The ISR pages are covered by their own segment cache; these two are
 * not, and they were the routes in the EMAXCONN report.
 *
 * `unstable_cache` and not `use cache`: the latter replaces it in Next 16 but
 * requires the `cacheComponents` flag, which changes rendering across the whole
 * app. That is the right migration and the wrong thing to do to a live site in
 * the same change as an outage fix.
 */
function cachedCorpusRead<A extends unknown[], R>(
  key: string,
  read: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return unstable_cache(read, [key], { tags: [CORPUS_TAG], revalidate: 86400 })
}

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
  /**
   * Standing on their own realm, when they have one.
   *
   * The global rank of a French founder is #97 and always will be; being 2nd of
   * 14 in France is a position worth defending. Null when TrustMRR never said
   * where they are, which is a third of the corpus — and an invented realm
   * would be worse than none.
   */
  realmRank: { realm: string; rank: number; total: number } | null
  above: { handle: string; level: number; mrrUsd: number } | null
  below: { handle: string; level: number; mrrUsd: number } | null
  /**
   * The best rank ever recorded, and the day it was held.
   *
   * Rank is the one number here that falls through no fault of the founder:
   * somebody else ships and everybody below them moves down. A peak that is
   * never taken away is the honest counterweight, and it is the same instinct
   * as the achievements — earned once, never revoked.
   *
   * Null until there is more than one day on record, because "best ever: today"
   * is not a fact, it is a restatement.
   */
  best: { rank: number; day: string } | null
}

/**
 * Where this character stands, beyond their class: realm and faction.
 *
 * Both come off the `characters` row rather than being re-derived from the raw
 * payloads here. They used to be re-derived, which meant the sheet and the
 * ladder could disagree about the same founder — the sheet counted every
 * product's country, the ladder had no opinion at all. The engine decides once,
 * compute writes it down, everything reads the same answer.
 */
export interface SheetProfile {
  realm: string | null
  faction: Faction | null
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
  /** How much of the paper doll is filled. See CharacterSheet.equipped. */
  equipped: { worn: number; total: number }
  characterClass: CharacterClass
  /** The character's own quality, from its level. Colours the portrait. */
  rarity: Rarity
  /**
   * The gear score's quality, from the iLvl — a different band off a different
   * number, and never the character's.
   *
   * The ladder worked this out first: level rarity paints the entire top 20 one
   * colour, so a sheet that borrowed it for the iLvl was showing a founder the
   * colour of their level twice and the colour of their gear never. Null when
   * there is no iLvl to score.
   */
  ilvlRarity: Rarity | null
  xp: number
  nProducts: number
  mrrUsd: number
  revenueTotalUsd: number
  rank: number
  rankContext: RankContext | null
  profile: SheetProfile
  /** For the timeline: when we first saw them, and their last level-up. */
  firstSeenAt: string
  leveledAt: string | null
  previousLevel: number | null
  stats: SheetStats
  history: HistoryPoint[]
  progress: { current: number; next: number | null; ratio: number }
  achievements: { code: string; earnedOn: string }[]
  /**
   * The paper doll: seventeen slots, one per stat, always in table order and
   * always all seventeen — an empty slot is part of the answer.
   */
  doll: EquippedSlot[]
  /** The founder's products. Gear in the older sense, and a different section. */
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
  claimed_at: Date | string | null
  // timestamptz comes back as a Date, exactly like the date columns do.
  first_seen_at: Date | string
  xp: string
  level: number
  ilvl: number | null
  class: string
  realm: string | null
  faction: string | null
  n_products: number
  mrr_cents: string
  revenue_total_cents: string
  customers: number
  active_subscriptions: number
  growth_mrr_30d: string | null
  /* Achievement progress only, and all nullable: they were added after the
     table existed, so a row that has not been recomputed since carries nulls
     rather than zeroes. */
  visitors_30d: number | null
  categories: number | null
  stack_size: number | null
  profit_margin_30d: string | null
  google_impressions_30d: string | null
  products_earning: number | null
  previous_level: number | null
  leveled_at: Date | string | null
}

/**
 * Returns null if the sheet does not exist or the founder opted out.
 *
 * Wrapped in React's `cache` because Next renders `generateMetadata` and the
 * page body of the same route concurrently, and both need the sheet. Without
 * it every character page reads the database twice for one visitor.
 */
const getCharacterUncached = async (rawHandle: string): Promise<CharacterPage | null> => {
  const sql = db()
  const handle = rawHandle.replace(/^@/, '').toLowerCase()

  const [row] = await sql<CharacterRow[]>`
    select c.handle, f.display_name, f.avatar_url, f.claimed_at, f.first_seen_at,
           c.xp, c.level, c.ilvl, c.class, c.realm, c.faction,
           c.n_products, c.mrr_cents, c.revenue_total_cents,
           c.customers, c.active_subscriptions, c.growth_mrr_30d,
           c.visitors_30d, c.categories, c.stack_size, c.profit_margin_30d,
           c.google_impressions_30d, c.products_earning,
           c.previous_level, c.leveled_at
    from characters c
    join founders f on f.handle = c.handle
    where c.handle = ${handle}
      and f.opted_out_at is null
  `
  if (!row) return null

  const [achievements, products, rankRow, edges, historyRows, bestRow] = await Promise.all([
    // `earned_on` is a date column, so it arrives as a Date. Third time this
    // has bitten: every date and timestamp out of postgres.js is an object, and
    // everything downstream of this file expects a string.
    sql<{ code: string; earned_on: Date | string }[]>`
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
        raw: TrustmrrStartup | null
        /* The four below are read by nothing on this page directly. They are
           here so `toProduct` can run over these rows and hand the engine a
           real aggregate for the paper doll — see the `doll` field. */
        revenue_total_cents: string | null
        active_subscriptions: number | null
        growth_mrr_30d: string | null
        visitors_30d: number | null
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
             snap.domain_rating, snap.founded_date, snap.raw,
             snap.revenue_total_cents, snap.active_subscriptions,
             snap.growth_mrr_30d, snap.visitors_30d
      from founder_startups fs
      join startups s on s.slug = fs.startup_slug
      left join lateral (
        select mrr_cents, last30d_cents, customers, domain_rating, founded_date, raw,
               revenue_total_cents, active_subscriptions, growth_mrr_30d, visitors_30d
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
        realm: string | null
        realm_rank: string | null
        realm_total: string | null
        above_handle: string | null
        above_level: number | null
        above_mrr: string | null
        below_handle: string | null
        below_level: number | null
        below_mrr: string | null
      }[]
    >`
      with ranked as (
        select c.handle, c.class, c.realm, c.level, c.mrr_cents,
               row_number() over w                                as rank,
               row_number() over (partition by c.class order by
                 c.level desc, c.ilvl desc nulls last, c.handle)  as class_rank,
               -- Partitioning by a nullable column groups every realm-less
               -- founder into one bucket, so the rank is only read out below
               -- when the realm is actually set.
               row_number() over (partition by c.realm order by
                 c.level desc, c.ilvl desc nulls last, c.handle)  as realm_rank,
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
      select r.rank, r.class_rank, r.realm, r.realm_rank,
             (select count(*) from ranked)                          as total,
             (select count(*) from ranked x where x.class = r.class) as class_total,
             (select count(*) from ranked x where x.realm = r.realm) as realm_total,
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
    /*
     * Best rank ever held.
     *
     * Read from character_days rather than cached on `characters`, because
     * `characters` is dropped by a reset and this must not be: the ladder as it
     * stood last Tuesday cannot be recomputed from anything. `days` comes back
     * so the caller can refuse to print "best ever" on the first day, when it
     * would only be restating today's rank.
     */
    sql<{ rank: number | null; day: Date | string | null; days: number }[]>`
      select min(rank)::int as rank,
             (select captured_on from character_days
               where handle = ${handle} order by rank, captured_on limit 1) as day,
             count(*)::int as days
      from character_days
      where handle = ${handle}
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
  const leveledAt = asIso(row.leveled_at)
  const leveledRecently = leveledAt !== null && new Date(leveledAt).getTime() > sevenDaysAgo
  /**
   * Backfill is not news.
   *
   * Every achievement is retroactive, so the first compute for a founder stamps
   * all of them with today's date. Treating those as "just earned" made every
   * single OG image show an achievement toast on day one. An achievement only
   * counts as an event if it landed after we already knew the founder.
   */
  const followers = maxOf(products.map((p) => asInt(p.raw?.xFollowerCount)))

  /*
   * The paper doll, from the same aggregate the ladder was computed from.
   *
   * Re-derived here rather than stored: it is a pure function of the products
   * we have already loaded, and a `doll` column would be a cache of something
   * cheaper to recompute than to invalidate. Going through `toProduct` and
   * `aggregateFounder` rather than assembling an input by hand is what keeps
   * this honest — the doll cannot disagree with the stats panel above it,
   * because both sides read the same object.
   */
  const doll = equipmentFor(
    equipmentInput(
      aggregateFounder(
        handle,
        products.map((p) =>
          toProduct({
            ...p,
            startup_slug: p.slug,
            // postgres.js returns a Date for a `date` column while compute.ts
            // reads that column as a string. Both are right about their own
            // query; normalising here is what lets the two share a mapper.
            founded_date: asDay(p.founded_date),
          }),
        ),
      ),
      // The class as compute wrote it, never re-derived here: the doll decides
      // whether this founder holds a staff or an axe, and it must agree with
      // the class printed at the top of the same page.
      row.class as CharacterClass,
    ),
  )

  const knownSince = new Date(asIso(row.first_seen_at) ?? 0).getTime()
  // Normalised once, here, so no caller ever has to know what postgres.js
  // hands back.
  const earned = achievements.map((a) => ({ code: a.code, earnedOn: asDay(a.earned_on) ?? '' }))
  const freshAchievement = earned.find((a) => {
    const at = new Date(a.earnedOn).getTime()
    return at > sevenDaysAgo && at > knownSince
  })

  return {
    handle: row.handle,
    // xFounderName when TrustMRR has it, the handle otherwise.
    displayName: row.display_name ?? row.handle,
    avatarUrl: row.avatar_url,
    claimed: row.claimed_at !== null,
    level,
    ilvl: row.ilvl,
    equipped: equipmentScore(doll),
    characterClass: row.class as CharacterClass,
    rarity: rarityFor(level),
    ilvlRarity: row.ilvl === null ? null : rarityFor(row.ilvl),
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
          realmRank: realmRankOf(rankRowOne),
          best: bestOf(bestRow[0]),
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
    profile: {
      realm: normalizeRealm(row.realm),
      faction: asFaction(row.faction),
    },
    firstSeenAt: asIso(row.first_seen_at) ?? new Date().toISOString(),
    leveledAt: asIso(row.leveled_at),
    previousLevel: row.previous_level,
    stats: {
      last30dUsd,
      arpu: effectiveCustomers > 0 ? mrrUsd / effectiveCustomers : null,
      growthMrr30d,
      domainRating,
      // Derived from the products payload rather than asked for separately:
      // every extra parallel query pushes the peak concurrency this file has to
      // stay under, and xFollowerCount was already in the raw we fetch.
      followers,
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
      // Null here means the column predates this founder's last compute, not
      // that the value is zero — but a progress bar has to draw something, and
      // the next nightly run fills them in. Only profitMargin keeps its null,
      // because that one distinguishes "no margin reported" from "0% margin".
      visitors30d: row.visitors_30d ?? 0,
      categories: row.categories ?? 0,
      stackSize: row.stack_size ?? 0,
      profitMargin30d: row.profit_margin_30d === null ? null : Number(row.profit_margin_30d),
      googleImpressions30d: Number(row.google_impressions_30d ?? 0),
      productsEarning: row.products_earning ?? 0,
    },
    progress: {
      current,
      next,
      ratio: next === null ? 1 : Math.min(Math.max((xp - current) / (next - current), 0), 1),
    },
    achievements: earned,
    doll,
    equipment: products.map((p) => {
      const productMrr = Number(p.mrr_cents ?? 0) / 100
      /*
       * The Main Hand ladder, which is where MRR already lives.
       *
       * A product's score and the character's iLvl are the same kind of number
       * on the same page, so they have to come out of the same thresholds. They
       * did not: this was `itemLevelFor` (MRR over twelve months, the formula
       * the doll replaced) coloured by RARITY_BANDS, which index on a
       * character's LEVEL rather than on an item's quality.
       */
      const score = scoreOnSlot('mainHand', productMrr)
      const raw = (p.raw ?? {}) as Record<string, unknown>
      const insights = (raw.startupInsights ?? {}) as Record<string, unknown>
      return {
        slug: p.slug,
        name: p.name ?? p.slug,
        website: p.website,
        iconUrl: p.icon_url,
        mrrUsd: productMrr,
        itemLevel: score?.itemLevel ?? null,
        rarity: score?.rarity ?? RARITY_BY_NAME.get('common') ?? { name: 'common', hex: '#ffffff' },
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
    recentAchievement: freshAchievement ?? null,
  }
}

/**
 * The character sheet: six queries, and the single most requested route here.
 *
 * Two layers, and they do different jobs. `unstable_cache` is the one that
 * matters — measured at 7.2 database transactions per request without it and
 * effectively none with it, on a page whose data changes once a night. Next
 * does not give this route segment ISR: it is a dynamic segment with no
 * generateStaticParams, so every visit re-rendered and re-queried, which is why
 * /c/[handle] was in the EMAXCONN report alongside /ladder.
 *
 * React `cache` stays wrapped around it because it solves a different problem:
 * Next renders `generateMetadata` and the page body concurrently and both read
 * the sheet, and per-request dedupe is what keeps that one call rather than
 * two. Dropping it would double the miss cost of every cold render — and the
 * item-level average depends on it, since that is what makes the doll agree
 * with the class printed above it.
 */
export const getCharacter = cache(cachedCorpusRead('character', getCharacterUncached))

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
  realm: string | null
  faction: Faction | null
}

/**
 * What a visitor may narrow the ladder by.
 *
 * Three axes, and they compose: "Hunters on FR selling B2B" is four founders
 * and a far more useful page than the global top hundred, which a French
 * founder will never appear on and therefore has no reason to read twice.
 */
export interface LadderFilter {
  characterClass?: string | null
  realm?: string | null
  faction?: string | null
  /** An achievement code. Narrows to the founders who hold it. */
  achievement?: string | null
}

/** What a page of the ladder asks for, on top of the three facets. */
/**
 * What the ladder is ordered by.
 *
 * `level` is lifetime output — revenue banked plus products shipped — and it is
 * the default because it is the one number nobody can lose. `ilvl` is the mean
 * of the gear worn right now, so it reorders the board toward whoever is
 * currently best equipped rather than whoever has been at it longest. The two
 * genuinely disagree, which is the reason both exist.
 */
export type LadderSort = 'level' | 'ilvl'

export const LADDER_SORTS: readonly { key: LadderSort; label: string }[] = [
  { key: 'level', label: 'Level' },
  { key: 'ilvl', label: 'Item level' },
]

export interface LadderQuery extends LadderFilter {
  /** Defaults to 'level'. */
  sort?: LadderSort | null
  /**
   * Free text over handle and display name. It never changes anybody's rank:
   * the point of finding yourself on the ladder is seeing where you actually
   * stand, not being told you are first out of one.
   */
  q?: string | null
  /** 1-based. Out of range is not an error; it yields no rows and a real total. */
  page?: number
}

export interface LadderPage {
  sort: LadderSort
  rows: LadderRow[]
  /** Rows matching the facets and the search — what the pager counts. */
  total: number
  page: number
  perPage: number
  pageCount: number
}

export const LADDER_PAGE_SIZE = 100

/**
 * A page of the ladder, ordered by level then iLvl.
 *
 * It used to return the top hundred and nothing else, on the reasoning that we
 * show a top and never the floor — WoW never published a leaderboard of the
 * worst players. That principle survives the ordering but not the cut: with a
 * corpus past a thousand, a hard limit of a hundred meant most founders could
 * not find themselves at all, which is worse than being far down a list. The
 * list still starts at the top, still ranks by the same two numbers, and still
 * labels nobody as last.
 *
 * Rank comes from a window function over the facet-filtered set rather than
 * from the row's position in the result. Those agree only on page one, and only
 * without a search: `index + 1` would tell the 400th founder they are 1st.
 */
async function getLadderUncached(query: LadderQuery = {}): Promise<LadderPage> {
  const sql = db()
  const realm = normalizeRealm(query.realm)
  const faction = asFaction(query.faction ?? null)
  const characterClass = query.characterClass ?? null
  const achievement = query.achievement ?? null
  const q = query.q?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const like = `%${q}%`
  const perPage = LADDER_PAGE_SIZE
  const page = Math.max(Math.trunc(query.page ?? 1) || 1, 1)
  // Anything unrecognised falls back to the default rather than erroring: this
  // arrives from a query string, and a hand-typed `?sort=lvl` should show the
  // ladder, not a 500.
  const sort: LadderSort = query.sort === 'ilvl' ? 'ilvl' : 'level'

  // The facets decide which ladder this is, and therefore what a rank means.
  const facets = sql`
    where f.opted_out_at is null
      ${characterClass ? sql`and c.class = ${characterClass}` : sql``}
      ${realm ? sql`and c.realm = ${realm}` : sql``}
      ${faction ? sql`and c.faction = ${faction}` : sql``}
      ${
        achievement
          ? sql`and exists (
              select 1 from character_achievements a
              where a.handle = c.handle and a.code = ${achievement}
            )`
          : sql``
      }
  `

  /*
   * Counted separately rather than with `count(*) over ()`, because a window
   * count rides on the returned rows and a page past the end returns none — so
   * the pager would lose the total exactly when it needs it to say how far past
   * the end you are. Two statements in parallel, both trivial at this size.
   */
  const [[counted], rows] = await Promise.all([
    sql<{ total: number }[]>`
      select count(*)::int as total
      from characters c
      join founders f on f.handle = c.handle
      ${facets}
      ${q ? sql`and (c.handle ilike ${like} or f.display_name ilike ${like})` : sql``}
    `,
    /*
     * The CTE is load-bearing, not decoration. A window function runs after
     * `where`, so folding the search into the same statement would renumber the
     * matches 1..n and tell the 400th founder they are first. Ranking happens
     * over the facets alone; the search then filters rows that already know
     * where they stand.
     */
    sql<
      {
        rank: number
        handle: string
        level: number
        ilvl: number | null
        class: string
        n_products: number
        realm: string | null
        faction: string | null
      }[]
    >`
      with ranked as (
        select
          c.handle, c.level, c.ilvl, c.class, c.n_products, c.realm, c.faction,
          f.display_name,
          (row_number() over (
            /*
             * nulls last on either axis: an unmeasured stat is "not measured",
             * never "worst". A founder wearing nothing has no item level, and
             * sorting them below everybody is right — sorting them below
             * everybody because null sorts high would not be.
             *
             * The secondary key is the other axis, not the handle: two founders
             * tied on item level should be split by what they have built, and
             * alphabetical order is not a tiebreak, it is a coin toss with a
             * permanent winner.
             */
            ${
              sort === 'ilvl'
                ? sql`order by c.ilvl desc nulls last, c.level desc, c.handle`
                : sql`order by c.level desc, c.ilvl desc nulls last, c.handle`
            }
          ))::int as rank
        from characters c
        join founders f on f.handle = c.handle
        ${facets}
      )
      select rank, handle, level, ilvl, class, n_products, realm, faction
      from ranked
      ${q ? sql`where handle ilike ${like} or display_name ilike ${like}` : sql``}
      order by rank
      limit ${perPage} offset ${(page - 1) * perPage}
    `,
  ])

  const total = counted?.total ?? 0
  return {
    sort,
    total,
    page,
    perPage,
    pageCount: Math.max(Math.ceil(total / perPage), 1),
    rows: rows.map((row) => ({
      rank: row.rank,
      handle: row.handle,
      level: row.level,
      ilvl: row.ilvl,
      characterClass: row.class as CharacterClass,
      rarity: rarityFor(row.level),
      ilvlRarity: row.ilvl === null ? null : rarityFor(row.ilvl),
      nProducts: row.n_products,
      realm: normalizeRealm(row.realm),
      faction: asFaction(row.faction),
    })),
  }
}

export interface FacetCount<T extends string = string> {
  value: T
  count: number
}

/** One row in the compare picker: enough to recognise somebody, nothing more. */
export interface PickerFounder {
  handle: string
  displayName: string
  level: number
  characterClass: CharacterClass
  rarity: Rarity
}

/** The picker never shows more than a handful, so nothing larger is ever sent. */
const PICKER_LIMIT = 8

/**
 * Founders for the compare picker: the strongest few, or those matching a query.
 *
 * This used to return the whole corpus and filter in the browser, on the
 * reasoning that 142 rows are a few kilobytes and a round trip per keystroke
 * would be slower. That reasoning was right and is now wrong: discovering the
 * rest of TrustMRR takes the corpus past a thousand, and shipping all of it to
 * every visitor of /compare to render eight rows is hundreds of kilobytes spent
 * on data nobody sees.
 *
 * Matching is server-side and prefix-weighted: somebody typing "zach" wants
 * @zachly before @seanzachary, and ranking by level alone would bury them.
 */
async function getComparableFoundersUncached(query?: string): Promise<PickerFounder[]> {
  const sql = db()
  const q = query?.trim().replace(/^@/, '').toLowerCase() ?? ''

  const rows = await sql<
    { handle: string; display_name: string | null; level: number; class: string }[]
  >`
    select c.handle, f.display_name, c.level, c.class
    from characters c
    join founders f on f.handle = c.handle
    where f.opted_out_at is null
      ${q ? sql`and (c.handle ilike ${`%${q}%`} or f.display_name ilike ${`%${q}%`})` : sql``}
    order by
      ${q ? sql`(c.handle ilike ${`${q}%`} or f.display_name ilike ${`${q}%`}) desc,` : sql``}
      c.level desc, c.ilvl desc nulls last, c.handle
    limit ${PICKER_LIMIT}
  `
  return rows.map((row) => ({
    handle: row.handle,
    displayName: row.display_name ?? row.handle,
    level: row.level,
    characterClass: row.class as CharacterClass,
    rarity: rarityFor(row.level),
  }))
}

/** One founder by handle, so a `?a=` slot can pre-fill without loading a list. */
export async function getPickerFounder(handle: string): Promise<PickerFounder | null> {
  const [row] = await getComparableFoundersByHandles([handle])
  return row ?? null
}

async function getComparableFoundersByHandles(handles: string[]): Promise<PickerFounder[]> {
  if (handles.length === 0) return []
  const sql = db()
  const rows = await sql<
    { handle: string; display_name: string | null; level: number; class: string }[]
  >`
    select c.handle, f.display_name, c.level, c.class
    from characters c
    join founders f on f.handle = c.handle
    where f.opted_out_at is null and c.handle = any(${handles})
  `
  return rows.map((row) => ({
    handle: row.handle,
    displayName: row.display_name ?? row.handle,
    level: row.level,
    characterClass: row.class as CharacterClass,
    rarity: rarityFor(row.level),
  }))
}

/**
 * The realms with anybody on them, largest first.
 *
 * Unlike classes, this list is long and lopsided — 80 of 139 characters sit on
 * US and the tail is a dozen realms of one. Callers cap it; the query does not,
 * because a realm of one is still a page that founder will visit.
 */
async function getRealmCountsUncached(): Promise<FacetCount[]> {
  const sql = db()
  const rows = await sql<{ realm: string; n: number }[]>`
    select c.realm, count(*)::int as n
    from characters c
    join founders f on f.handle = c.handle
    where f.opted_out_at is null and c.realm is not null
    group by c.realm
    order by n desc, c.realm
  `
  return rows.flatMap((r) => {
    const realm = normalizeRealm(r.realm)
    return realm ? [{ value: realm, count: r.n }] : []
  })
}

async function getFactionCountsUncached(): Promise<FacetCount<Faction>[]> {
  const sql = db()
  const rows = await sql<{ faction: string; n: number }[]>`
    select c.faction, count(*)::int as n
    from characters c
    join founders f on f.handle = c.handle
    where f.opted_out_at is null and c.faction is not null
    group by c.faction
    order by n desc, c.faction
  `
  return rows.flatMap((r) => {
    const faction = asFaction(r.faction)
    return faction ? [{ value: faction, count: r.n }] : []
  })
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
 * Was this sheet removed, rather than never existing?
 *
 * A removed sheet 404s to the world, which is the point — but it also 404s to
 * the person who removed it, so somebody who clicks the button by mistake has
 * nowhere to go. This is the one query allowed to see past `opted_out_at`, and
 * the page that uses it shows nothing about the founder: only that a sheet was
 * removed, and only to somebody signed in as that exact handle.
 */
export async function wasRemoved(rawHandle: string): Promise<boolean> {
  const sql = db()
  const handle = rawHandle.replace(/^@/, '').toLowerCase()
  const [row] = await sql<{ removed: boolean }[]>`
    select opted_out_at is not null as removed from founders where handle = ${handle}
  `
  return row?.removed ?? false
}

/**
 * Handles that belong in the sitemap.
 *
 * Claimed only, and that is the whole point: an unclaimed sheet is `noindex`,
 * so listing it here would be asking search engines to crawl a page that tells
 * them to go away. The rule the spec cares about — nobody is indexed until they
 * ask to be — has to hold in both places or it holds in neither.
 */
/**
 * The sheets worth submitting to a crawler.
 *
 * Two conditions, and they are not the same kind of rule.
 *
 * `opted_out_at is null` is consent and is absolute — a removed founder 404s,
 * so listing one would be advertising a dead URL as well as ignoring them.
 *
 * The revenue-or-products condition is an SEO judgement instead. 819 of the
 * 3,886 sheets report no revenue at all and a single product, which makes them
 * near-identical pages with nothing on them; a sitemap that asks Google to
 * crawl those spends the site's crawl budget proving they are thin. They are
 * still perfectly indexable and still reachable from the ladder — they are just
 * not submitted, which is the difference between hiding a page and not
 * recommending it.
 */
export const getIndexableHandles = cache(
  async (): Promise<{ handle: string; updatedAt: string }[]> => {
    const sql = db()
    const rows = await sql<{ handle: string; at: string }[]>`
      select c.handle, c.computed_at::text as at
      from characters c
      join founders f on f.handle = c.handle
      where f.opted_out_at is null
        and (c.revenue_total_cents > 0 or c.mrr_cents > 0 or c.n_products > 1)
      order by c.level desc
      limit 45000
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
async function getClassCountsUncached(): Promise<{ name: string; count: number }[]> {
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

/**
 * How many founders hold each achievement.
 *
 * Ordered by rarity and then by size, not by size alone like every other facet
 * here. The other three answer "what kind of founder"; this one answers "who
 * did the hard thing", and burying `legendary` under `lone_wolf` because 1,142
 * people have no cofounder would put the interesting filters last.
 */
async function getAchievementCountsUncached(): Promise<FacetCount[]> {
  const sql = db()
  const rows = await sql<{ code: string; n: number }[]>`
    select a.code, count(*)::int as n
    from character_achievements a
    join founders f on f.handle = a.handle
    join characters c on c.handle = a.handle
    where f.opted_out_at is null
    group by a.code
  `
  const order = new Map(RARITY_ORDER.map((name, i) => [name, i]))
  return rows
    .flatMap((r) => {
      const def = ACHIEVEMENTS_BY_CODE.get(r.code)
      // A code with no definition is a retired achievement still on somebody's
      // record. It stays on their sheet and is not offered as a filter.
      return def ? [{ value: r.code, count: r.n, rank: order.get(def.rarity) ?? 0 }] : []
    })
    .sort((a, b) => b.rank - a.rank || b.count - a.count || a.value.localeCompare(b.value))
    .map(({ value, count }) => ({ value, count }))
}

/** Commonest first, so a higher index is a rarer badge. */
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const

export async function getClasses(): Promise<string[]> {
  const sql = db()
  const rows = await sql<{ class: string }[]>`
    select distinct class from characters order by class
  `
  return rows.map((r) => r.class)
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

/** timestamptz columns arrive as Date objects; the sheet wants a string. */
const asIso = (v: Date | string | null): string | null => {
  if (v instanceof Date) return v.toISOString()
  return isText(v) ? v : null
}

/** `date` columns arrive as Date objects; everything downstream wants a day. */
const asDay = (v: Date | string | null): string | null => {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return isText(v) ? v.slice(0, 10) : null
}
const asText = (v: unknown): string | null => (isText(v) ? v : null)
const asInt = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null

const maxOf = (values: (number | null)[]): number | null => {
  const present = values.filter((v): v is number => v !== null)
  return present.length ? Math.max(...present) : null
}

/**
 * A stored faction, narrowed back to the union.
 *
 * The column is plain text and the engine is the only writer, but a value that
 * predates a rename would otherwise flow into the UI as a faction nobody has a
 * colour or a tagline for.
 */
const asFaction = (v: string | null): Faction | null =>
  v === 'B2B' || v === 'B2C' || v === 'Both' ? v : null

/**
 * A realm standing is only worth printing when there is a realm and more than
 * one person on it. "1st of 1 in Slovenia" is a joke at that founder's expense,
 * and there are four realms in the corpus with exactly one character on them.
 */
/**
 * "Best ever" needs at least two days on record.
 *
 * On day one the peak IS today's rank, and printing it would be a restatement
 * dressed as an achievement — the sort of empty flourish that teaches people to
 * stop reading the panel.
 */
const bestOf = (
  row: { rank: number | null; day: Date | string | null; days: number } | undefined,
): { rank: number; day: string } | null => {
  if (!row || row.rank === null || row.days < 2) return null
  const day = asDay(row.day)
  return day ? { rank: row.rank, day } : null
}

const realmRankOf = (row: {
  realm: string | null
  realm_rank: string | null
  realm_total: string | null
}): { realm: string; rank: number; total: number } | null => {
  const realm = normalizeRealm(row.realm)
  const total = Number(row.realm_total ?? 0)
  if (!realm || total < 2) return null
  return { realm, rank: Number(row.realm_rank ?? 0), total }
}

/*
 * The corpus reads that /ladder and /compare make on every request.
 *
 * Six queries a visit between them, all against a table that changes once a
 * night. Wrapped rather than inlined so the query bodies above stay readable as
 * queries — and so the tag is applied in one place instead of six.
 *
 * getLadder keys on its arguments, which is what makes a filtered ladder and
 * the bare one separate entries rather than one of them evicting the other.
 */
export const getLadder = cachedCorpusRead('ladder', getLadderUncached)
export const getComparableFounders = cachedCorpusRead('picker', getComparableFoundersUncached)
export const getRealmCounts = cachedCorpusRead('realm-counts', getRealmCountsUncached)
export const getFactionCounts = cachedCorpusRead('faction-counts', getFactionCountsUncached)
export const getClassCounts = cachedCorpusRead('class-counts', getClassCountsUncached)
export const getAchievementCounts = cachedCorpusRead(
  'achievement-counts',
  getAchievementCountsUncached,
)
