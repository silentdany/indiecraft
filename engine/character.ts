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
 */
export function ilvlFrom(aggregate: FounderAggregate): number {
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
    ilvlDelta: ilvl - level,
    class: classFrom(aggregate, level),
    rarity: rarityFor(level),
    nProducts: aggregate.nProducts,
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
 */
export function itemLevelFor(productMrrUsd: number): number {
  return levelFromXp(productMrrUsd * 12)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
