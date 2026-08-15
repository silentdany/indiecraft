import { equipmentFor, equipmentInput, equipmentScore, ilvlFromDoll } from './equipment'
import {
  ACHIEVEMENTS,
  CLASS_RULES,
  DEFAULT_CLASS,
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
 * iLvl: the mean item level of the gear they are wearing.
 *
 * ---------------------------------------------------------------------------
 * This used to be "the level this founder would hold if they sustained their
 * current MRR for twelve months", plus a growth bonus and a retention penalty.
 * It was the best answer available before the paper doll existed, and it had
 * one structural flaw no amount of tuning could reach: it asked a single stat
 * to speak for a whole founder. A ten-year-old business with ten technologies,
 * a real audience and no subscription revenue scored null; a founder whose only
 * fact was MRR scored the same as one who also had 4,000 customers, DR 70 and
 * 90% retention.
 *
 * Seventeen slots is the entire point of having built a doll. Averaging them is
 * also exactly what the game does, which means the number now means what a
 * player already expects it to mean.
 *
 * The growth bonus and the retention penalty are gone, not moved: both are
 * slots now — Feet is growth, Back is retention — so applying them again on top
 * of the average would count them twice. The two helpers that applied them, and
 * the ILVL constants they read, are deleted rather than left commented out —
 * the git history is the archive.
 * ---------------------------------------------------------------------------
 *
 * Null when they are wearing nothing at all, which is the same shape of answer
 * as before and for the same reason: no data is not a bad score.
 */
export function ilvlFrom(
  aggregate: FounderAggregate,
  characterClass: CharacterClass,
): number | null {
  return ilvlFromDoll(equipmentFor(equipmentInput(aggregate, characterClass)))
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
  // Class first: it decides which variant of each item is worn, and the doll is
  // what the item level averages.
  const characterClass = classFrom(aggregate, level)
  const doll = equipmentFor(equipmentInput(aggregate, characterClass))
  const ilvl = ilvlFromDoll(doll)
  const { current, next } = levelBounds(level)

  return {
    handle: aggregate.handle,
    xp,
    level,
    ilvl,
    equipped: equipmentScore(doll),
    class: characterClass,
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
