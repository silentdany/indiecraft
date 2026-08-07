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
}

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
}

export type CharacterClass =
  | 'Adventurer'
  | 'Priest'
  | 'Rogue'
  | 'Warrior'
  | 'Hunter'
  | 'Bard'
  | 'Mage'

export interface AchievementDef {
  code: string
  label: string
  /** Always phrased positively. Test: would this person be happy to screenshot it? */
  description: string
  test: (a: FounderAggregate, level: number) => boolean
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
  ilvl: number
  /** ilvl - level. The one number actually worth showing. */
  ilvlDelta: number
  class: CharacterClass
  rarity: Rarity
  nProducts: number
  achievements: string[]
  /** Remaining XP and [0,1] progress toward the next level. */
  progress: { current: number; next: number | null; ratio: number }
}
