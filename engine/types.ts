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
  | 'Ranger'
  | 'Hunter'
  | 'Bard'
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
}

export interface AchievementDef {
  code: string
  label: string
  /** Always phrased positively. Test: would this person be happy to screenshot it? */
  description: string
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
