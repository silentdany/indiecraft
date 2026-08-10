/** One of a founder's products, already converted to dollars. Cents stay at the edge. */
export interface ProductInput {
  slug: string
  name: string | null
  iconUrl: string | null
  /** revenue.total, lifetime, in dollars. */
  revenueTotalUsd: number
  /** revenue.mrr, in dollars. */
  mrrUsd: number
  customers: number
  activeSubscriptions: number
  /** growthMRR30d: 8.5 means +8.5%. */
  growthMrr30d: number | null
  domainRating: number | null
  visitors30d: number | null
  revenuePerVisitor: number | null
  foundedDate: string | null
  fundingStatus: string | null
  /** marketingChannels[].slug */
  channels: string[]
  /** techStack[].slug */
  stack: string[]
  /** cofounders[].xHandle */
  cofounders: string[]
  /** ISO 3166-1 alpha-2, the realm this product is registered on. */
  country: string | null
  /** startupInsights.businessType, falling back to targetAudience. */
  businessType: string | null
  /* --- Achievement-only. Nothing below feeds a level, a class or a rank. --- */
  /** e.g. 'Artificial Intelligence'. */
  category: string | null
  isMobileApp: boolean
  /** Percentage, 0–100. */
  profitMargin30d: number | null
  googleImpressions30d: number | null
  /** Set once by TrustMRR and never cleared, so it survives a delisting. */
  listedForSaleAt: string | null
}

/**
 * Who a founder sells to.
 *
 * TrustMRR answers this on roughly two thirds of listings, in exactly three
 * values, and it is the one dimension that splits the corpus close to evenly —
 * 59 B2B against 56 B2C. That makes it the armory's faction: not flavour, the
 * single most load-bearing fact about a business that a level cannot express.
 * 'Unknown' is normalised away at the edge, because a faction nobody belongs to
 * is not a faction.
 */
export type Faction = 'B2B' | 'B2C' | 'Both'

/**
 * The founder aggregate: the engine's input.
 * Every founder metric is the sum of their startups.
 */
export interface FounderAggregate {
  handle: string
  revenueTotalUsd: number
  mrrUsd: number
  customers: number
  activeSubscriptions: number
  nProducts: number
  /** activeSubscriptions / customers, clamped to [0,1]. Retention proxy — the API has no churn field. */
  retention: number
  /**
   * False when `customers` is 0, which TrustMRR returns constantly. Without
   * this flag, "no data" is indistinguishable from "everybody churned", and we
   * would penalize founders for a field they never filled in.
   */
  hasRetentionSignal: boolean
  /**
   * `customers` when populated, otherwise `activeSubscriptions`. Used for ARPU
   * only: dividing MRR by a zero customer count turns every large business into
   * a Rogue.
   */
  effectiveCustomers: number
  /** MRR-weighted average of growthMRR30d. */
  growthMrr30d: number
  /** Best domainRating across the founder's products. */
  domainRating: number | null
  /** Earliest foundedDate, ISO. */
  foundedFirst: string | null
  channels: string[]
  stack: string[]
  cofounders: string[]
  fundingStatuses: string[]
  /* --- Achievement-only, all summed or folded across the founder's products.
     Kept apart from the block above because none of it is allowed to reach the
     level, the class or the ladder: a badge may read a thin field, a ranking
     may not. --- */
  visitors30d: number
  /** Distinct `category` values across the products. */
  categories: string[]
  hasMobileApp: boolean
  /** Best margin across the products, percent. Null when none reported one. */
  profitMargin30d: number | null
  googleImpressions30d: number
  everListedForSale: boolean
  /** Two products or more, every one of them earning. */
  allProductsEarning: boolean
  /**
   * Realm and faction: where they build, and who they sell to.
   *
   * Both are the commonest answer across the founder's products rather than the
   * first, because a founder with three B2B tools and one consumer app is a B2B
   * founder. Null is a real answer here and has to survive to the sheet — a
   * missing country is not "unknown realm", it is a field TrustMRR never
   * filled, and inventing a default would put people somewhere they never said
   * they were.
   */
  realm: string | null
  faction: Faction | null
}

export type CharacterClass =
  | 'Adventurer'
  | 'Priest'
  | 'Rogue'
  | 'Warrior'
  | 'Paladin'
  | 'Evoker'
  | 'Hunter'
  | 'Shaman'
  | 'Warlock'
  | 'Monk'
  | 'Mage'

/**
 * The live numbers a locked achievement measures itself against.
 *
 * Deliberately a smaller object than FounderAggregate: the sheet reads it from
 * the database rather than re-deriving an aggregate, and a narrow shape makes
 * plain which fields a progress bar is allowed to depend on.
 */
export interface AchievementProgressInput {
  revenueTotalUsd: number
  mrrUsd: number
  customers: number
  activeSubscriptions: number
  nProducts: number
  retention: number
  hasRetentionSignal: boolean
  growthMrr30d: number
  domainRating: number | null
  level: number
  cofounders: number
  /* The numeric achievement fields, so a locked badge can show a bar rather
     than a blank. The boolean ones — a mobile app, a listing, a faction — have
     no bar to show and are absent on purpose. */
  visitors30d: number
  categories: number
  stackSize: number
  profitMargin30d: number | null
  googleImpressions30d: number
  productsEarning: number
}

/** The five quality tiers, by name. The hexes live in RARITY_BANDS. */
export type RarityName = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface AchievementDef {
  code: string
  label: string
  /** Always phrased positively. Test: would this person be happy to screenshot it? */
  description: string
  /**
   * Quality, in the same five tiers as a level and an item.
   *
   * Set here rather than computed from how many people hold it, which was the
   * obvious idea and the wrong one: a share that moves with the corpus means a
   * founder's epic quietly becomes a rare when enough others catch up, and
   * every badge on this site is supposed to be a thing that cannot be taken
   * away. Fixed like an item's quality — calibrated against the corpus once,
   * with the share of the day recorded beside each one.
   */
  rarity: RarityName
  test: (a: FounderAggregate, level: number) => boolean
  /**
   * How close they are, when that is a fair thing to show.
   *
   * Null for achievements where a bar would lie: nobody is "60% of the way" to
   * having a cofounder, and a Veteran bar would tick regardless of anything
   * they do. A missing progress function is the honest answer, not a gap.
   */
  progress?: (p: AchievementProgressInput) => { current: number; target: number } | null
}

export interface Rarity {
  name: string
  hex: string
}

/** The engine's output. Pure function: no database access, no side effects. */
export interface CharacterSheet {
  handle: string
  xp: number
  level: number
  /** Null when the founder has no recurring revenue: the metric does not apply. */
  ilvl: number | null
  /** ilvl - level. The one number actually worth showing, when there is one. */
  ilvlDelta: number | null
  class: CharacterClass
  rarity: Rarity
  nProducts: number
  realm: string | null
  faction: Faction | null
  achievements: string[]
  /** Remaining XP and [0,1] progress toward the next level. */
  progress: { current: number; next: number | null; ratio: number }
}
