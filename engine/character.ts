import {
  ACHIEVEMENTS,
  CLASS_RULES,
  DEFAULT_CLASS,
  ILVL,
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  RARITY_BANDS,
  XP_PER_PRODUCT,
} from './tuning'
import type { CharacterClass, CharacterSheet, FounderAggregate, Rarity } from './types'

/**
 * XP.
 * The flat per-product grant means a founder who ships without charging still
 * makes progress.
 */
export function xpFrom(aggregate: FounderAggregate): number {
  return Math.floor(aggregate.revenueTotalUsd + XP_PER_PRODUCT * aggregate.nProducts)
}

/**
 * `level = last threshold ≤ xp`, clamped to [1, 60].
 *
 * Table lookup, not a formula: hand-tunable, and explainable in one screenshot.
 */
export function levelFromXp(xp: number): number {
  if (!Number.isFinite(xp) || xp < LEVEL_THRESHOLDS[0]!) return 1
  let level = 1
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]!) level = i + 1
    else break
  }
  return clamp(level, 1, MAX_LEVEL)
}

/** Entry threshold for a level, and the next one (null at max level). */
export function levelBounds(level: number): { current: number; next: number | null } {
  const i = clamp(level, 1, MAX_LEVEL) - 1
  return { current: LEVEL_THRESHOLDS[i]!, next: LEVEL_THRESHOLDS[i + 1] ?? null }
}

/**
 * iLvl: the level this founder would hold if they sustained their current MRR
 * for twelve months. One function for both numbers, and the semantics fall out
 * on their own.
 *
 * Returns null when there is no recurring revenue at all, because the question
 * iLvl asks has no answer then. Scoring a one-time-sales business at iLvl 1 is
 * the same mistake as the retention penalty the spec already forbids: it reads
 * as "worst possible gear" when the truth is "this metric does not apply to
 * how they sell". 32 of 141 founders are in that position, and 21 of them sat
 * in the top 100 displaying a flat 1.
 */
export function ilvlFrom(aggregate: FounderAggregate): number | null {
  if (aggregate.mrrUsd === 0) return null
  const base = levelFromXp(aggregate.mrrUsd * 12)
  return clamp(base + growthBonus(aggregate) - retentionMalus(aggregate), 1, MAX_LEVEL)
}

function growthBonus(a: FounderAggregate): number {
  if (a.growthMrr30d <= 0) return 0
  return Math.min(Math.floor(a.growthMrr30d / ILVL.growthStepPercent), ILVL.growthMaxBonus)
}

/**
 * This penalty stands in for churn, which the API does not expose.
 *
 * Two non-negotiable guards, both of the same shape — never punish someone for
 * data we don't have:
 *   - no penalty when activeSubscriptions is 0. For a one-time-purchase
 *     product the ratio is structurally zero, and every boilerplate seller
 *     would be punished for their business model.
 *   - no penalty without a retention signal at all, i.e. when TrustMRR reports
 *     customers: 0, which is most listings.
 */
function retentionMalus(a: FounderAggregate): number {
  if (!a.hasRetentionSignal) return 0
  if (a.activeSubscriptions === 0) return 0
  if (a.retention >= ILVL.retentionFloor) return 0
  const steps = Math.ceil((ILVL.retentionFloor - a.retention) / ILVL.retentionStep)
  return Math.min(steps, ILVL.retentionMaxMalus)
}

/**
 * Deterministic decision tree, first match wins.
 * The order lives in tuning.ts and is deliberate.
 */
export function classFrom(aggregate: FounderAggregate, level: number): CharacterClass {
  const arpu = aggregate.mrrUsd / Math.max(aggregate.effectiveCustomers, 1)
  const matched = CLASS_RULES.find((rule) => rule.test(aggregate, { level, arpu }))
  return matched?.class ?? DEFAULT_CLASS
}

/** Rarity, indexed on the founder's level. */
export function rarityFor(level: number): Rarity {
  const band = RARITY_BANDS.find((b) => level >= b.minLevel)
  return band?.rarity ?? RARITY_BANDS[RARITY_BANDS.length - 1]!.rarity
}

/** Codes of the achievements currently earned. */
export function achievementsFrom(aggregate: FounderAggregate, level: number): string[] {
  return ACHIEVEMENTS.filter((def) => def.test(aggregate, level)).map((def) => def.code)
}

/**
 * The engine. Founder aggregate in, character sheet out.
 * Pure function: no database access, no side effects, no clock beyond the
 * age-based achievements.
 */
export function computeCharacter(aggregate: FounderAggregate): CharacterSheet {
  const xp = xpFrom(aggregate)
  const level = levelFromXp(xp)
  const ilvl = ilvlFrom(aggregate)
  const { current, next } = levelBounds(level)

  return {
    handle: aggregate.handle,
    xp,
    level,
    ilvl,
    ilvlDelta: ilvl === null ? null : ilvl - level,
    class: classFrom(aggregate, level),
    rarity: rarityFor(level),
    nProducts: aggregate.nProducts,
    realm: aggregate.realm,
    faction: aggregate.faction,
    achievements: achievementsFrom(aggregate, level),
    progress: {
      current,
      next,
      ratio: next === null ? 1 : clamp((xp - current) / (next - current), 0, 1),
    },
  }
}

/**
 * A product is a piece of gear: its item level is the level it would be worth
 * on its own, over twelve months of its MRR.
 *
 * Null for the same reason as iLvl: a product that does not bill monthly has
 * no monthly score, and printing "item level 1" beside it says the opposite.
 */
export function itemLevelFor(productMrrUsd: number): number | null {
  if (productMrrUsd === 0) return null
  return levelFromXp(productMrrUsd * 12)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
