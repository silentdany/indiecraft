/**
 * ============================================================================
 *  THE ONLY TUNABLE FILE IN THE PROJECT
 * ============================================================================
 *
 * Level thresholds, rarity bands, the class decision tree, achievement
 * definitions. Nothing else. The rest of the engine is plumbing that reads
 * this file.
 *
 * This is an architectural constraint, not a style preference: the project is
 * open source, and these four objects are exactly what people will want to
 * argue about. A contributor must be able to propose a rebalance by touching
 * one file. If you have to edit anything else to rebalance, the engine has a
 * bug.
 */

import type { AchievementDef, CharacterClass, FounderAggregate, Rarity } from './types'

// ---------------------------------------------------------------------------
// 1. XP
// ---------------------------------------------------------------------------

/**
 * Flat XP granted per product shipped. Ensures a founder who ships without
 * charging still makes progress.
 */
export const XP_PER_PRODUCT = 500

// ---------------------------------------------------------------------------
// 2. Level table — a table, not a formula
// ---------------------------------------------------------------------------

/**
 * Minimum XP for each level, index 0 = level 1.
 *
 * Generated once by log-linear interpolation between the anchors
 * 1→1, 100→10, 1,000→20, 10,000→30, 100,000→40, 1,000,000→50, 10,000,000→60,
 * then rounded to round numbers. It is frozen in place on purpose: we don't
 * re-derive a log curve, we edit lines.
 *
 * Intended properties: the first dollar earned dings level 1, going 40→41
 * costs proportionally the same as 10→11, and nobody is out of reach.
 */
export const LEVEL_THRESHOLDS: readonly number[] = [
  // 1–10: $1 to $100
  1, 2, 3, 5, 8, 13, 22, 36, 60, 100,
  // 11–20: $100 to $1k
  125, 160, 200, 250, 320, 400, 500, 630, 800, 1_000,
  // 21–30: $1k to $10k
  1_250, 1_600, 2_000, 2_500, 3_200, 4_000, 5_000, 6_300, 8_000, 10_000,
  // 31–40: $10k to $100k
  12_500, 16_000, 20_000, 25_000, 32_000, 40_000, 50_000, 63_000, 80_000, 100_000,
  // 41–50: $100k to $1M
  125_000, 160_000, 200_000, 250_000, 320_000, 400_000, 500_000, 630_000, 800_000, 1_000_000,
  // 51–60: $1M to $10M
  1_250_000, 1_600_000, 2_000_000, 2_500_000, 3_200_000, 4_000_000, 5_000_000, 6_300_000, 8_000_000,
  10_000_000,
]

export const MAX_LEVEL = LEVEL_THRESHOLDS.length // 60

// ---------------------------------------------------------------------------
// 3. iLvl modifiers
// ---------------------------------------------------------------------------

export const ILVL = {
  /** growthMRR30d: +1 per 10% band, capped. */
  growthStepPercent: 10,
  growthMaxBonus: 5,
  /** Below this retention, a penalty applies: -1 per band, capped. */
  retentionFloor: 0.3,
  retentionStep: 0.05,
  retentionMaxMalus: 5,
} as const

// ---------------------------------------------------------------------------
// 4. Rarity — indexed on the founder's level
// ---------------------------------------------------------------------------

/** Standard item colors. A purple border reads without a single word. */
export const RARITY_BANDS: readonly { minLevel: number; rarity: Rarity }[] = [
  { minLevel: 55, rarity: { name: 'legendary', hex: '#ff8000' } },
  { minLevel: 40, rarity: { name: 'epic', hex: '#a335ee' } },
  { minLevel: 25, rarity: { name: 'rare', hex: '#0070dd' } },
  { minLevel: 10, rarity: { name: 'uncommon', hex: '#1eff00' } },
  { minLevel: 1, rarity: { name: 'common', hex: '#9d9d9d' } },
]

// ---------------------------------------------------------------------------
// 5. TrustMRR vocabularies
// ---------------------------------------------------------------------------

/**
 * marketingChannels and techStack slugs are closed vocabularies on TrustMRR's
 * side.
 *
 * TODO first crawl: `pnpm crawl --dump-slugs` prints every distinct slug seen.
 * Replace these lists with the real ones instead of continuing to guess. Until
 * that happens, Bard and Mage are under-assigned — never mis-assigned.
 */
export const SOCIAL_CHANNELS: readonly string[] = ['x-twitter', 'linkedin', 'youtube', 'tiktok']

export const SEO_CHANNELS: readonly string[] = ['seo', 'content-marketing']

export const AI_STACK: readonly string[] = [
  'openai',
  'anthropic',
  'langchain',
  'replicate',
  'huggingface',
  'llamaindex',
  'ollama',
  'mistral',
]

/**
 * How to treat VC-funded startups (spec section 4, "point à trancher").
 * An indie hacking ladder with venture-backed companies on it misses the point.
 *
 *   'mark'    — shown, flagged with a "VC" badge. Default.
 *   'exclude' — dropped from the ladder and from the computation entirely.
 *   'ignore'  — treated like everything else, no flag.
 */
export const FUNDING_POLICY: 'mark' | 'exclude' | 'ignore' = 'mark'

// ---------------------------------------------------------------------------
// 6. Class decision tree — deterministic, first match wins
// ---------------------------------------------------------------------------

/**
 * Order matters and is deliberate. Reordering these rules moves more character
 * sheets than changing any threshold.
 *
 * `Adventurer` is the class of insufficient data. It is neutral and never
 * demeaning: nobody should be able to read their class as a joke. If a new
 * class could land as an insult, it doesn't ship.
 */
export interface ClassRule {
  class: CharacterClass
  /** Why this class, in one sentence, displayable on the sheet. */
  reason: string
  test: (a: FounderAggregate, ctx: { level: number; arpu: number }) => boolean
}

export const CLASS_RULES: readonly ClassRule[] = [
  {
    class: 'Adventurer',
    reason: 'Where everything starts.',
    test: (a, { level }) => a.nProducts === 0 || level < 5,
  },
  {
    class: 'Priest',
    reason: 'Their customers stay.',
    test: (a) => a.retention > 0.6 && a.customers > 50,
  },
  {
    class: 'Rogue',
    reason: 'Few customers, big tickets.',
    test: (a, { arpu }) => a.customers <= 20 && arpu > 200,
  },
  {
    class: 'Warrior',
    reason: 'Volume, earned one dollar at a time.',
    test: (a, { arpu }) => a.customers > 500 && arpu < 20,
  },
  {
    class: 'Hunter',
    reason: 'Finds customers before they go looking.',
    test: (a) => a.channels.some((c) => SEO_CHANNELS.includes(c)) && (a.domainRating ?? 0) >= 30,
  },
  {
    class: 'Bard',
    reason: 'Their audience is their channel.',
    test: (a) => a.channels.some((c) => SOCIAL_CHANNELS.includes(c)),
  },
  {
    class: 'Mage',
    reason: 'Building with whatever just shipped.',
    test: (a) => a.stack.some((s) => AI_STACK.includes(s)),
  },
]

/** Safety net: never demeaning, always reachable. */
export const DEFAULT_CLASS: CharacterClass = 'Adventurer'

// ---------------------------------------------------------------------------
// 7. Achievements
// ---------------------------------------------------------------------------

const YEARS = (n: number) => n * 365.25 * 24 * 60 * 60 * 1000

const ageInMs = (iso: string | null): number =>
  iso ? Date.now() - new Date(iso).getTime() : Number.NEGATIVE_INFINITY

/**
 * All computable from the API, all retroactive, all phrased positively.
 * An earned achievement is never lost, even if the condition becomes false.
 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    code: 'first_blood',
    label: 'First Blood',
    description: 'The first dollar earned.',
    test: (a) => a.revenueTotalUsd >= 1,
  },
  {
    code: 'the_thousand',
    label: 'The Thousand',
    description: '$1,000 in lifetime revenue.',
    test: (a) => a.revenueTotalUsd >= 1_000,
  },
  {
    code: 'ramen',
    label: 'Ramen Profitable',
    description: '$1,000 in MRR.',
    test: (a) => a.mrrUsd >= 1_000,
  },
  {
    code: 'raid_boss',
    label: 'Raid Boss Slayer',
    description: '$10,000 in MRR.',
    test: (a) => a.mrrUsd >= 10_000,
  },
  {
    code: 'hundred_customers',
    label: 'Centurion',
    description: '100 customers.',
    test: (a) => a.customers >= 100,
  },
  {
    code: 'thousand_customers',
    label: 'Legion',
    description: '1,000 customers.',
    test: (a) => a.customers >= 1_000,
  },
  {
    code: 'multiboxer',
    label: 'Multiboxer',
    description: 'Three products shipped.',
    test: (a) => a.nProducts >= 3,
  },
  {
    code: 'alt_king',
    label: 'Alt King',
    description: 'Five products shipped.',
    test: (a) => a.nProducts >= 5,
  },
  {
    code: 'unkillable',
    label: 'Unkillable',
    description: '80% retention across at least 50 customers.',
    test: (a) => a.retention >= 0.8 && a.customers >= 50,
  },
  {
    code: 'ascension',
    label: 'Ascension',
    description: '+20% MRR over thirty days.',
    test: (a) => a.growthMrr30d >= 20,
  },
  {
    code: 'veteran',
    label: 'Veteran',
    description: 'Two years since the first launch.',
    test: (a) => ageInMs(a.foundedFirst) >= YEARS(2),
  },
  {
    code: 'lone_wolf',
    label: 'Lone Wolf',
    description: 'No cofounder on any product.',
    test: (a) => a.nProducts > 0 && a.cofounders.length === 0,
  },
  {
    code: 'guilded',
    label: 'Guilded',
    description: 'At least one cofounder.',
    test: (a) => a.cofounders.length >= 1,
  },
  {
    code: 'authority',
    label: 'Authority',
    description: 'Domain rating of 50 or above.',
    test: (a) => (a.domainRating ?? 0) >= 50,
  },
  {
    code: 'ding_sixty',
    label: 'Ding 60',
    description: 'Max level.',
    test: (_a, level) => level >= MAX_LEVEL,
  },
]

export const ACHIEVEMENTS_BY_CODE = new Map(ACHIEVEMENTS.map((a) => [a.code, a]))
