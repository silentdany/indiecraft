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
 * The real vocabularies, taken from a full crawl on 2026-08-08 rather than
 * guessed. `pnpm crawl --dump-slugs` reprints them.
 *
 * The guessed lists were worse than useless: they contained `x-twitter`, which
 * does not exist — the slug is `twitter` — so the Bard rule matched nothing at
 * all while looking perfectly reasonable.
 *
 * marketingChannels (35): affiliate, app-store-optimization, blog,
 *   cold-calling, cold-dm, cold-email, content-marketing, discord,
 *   email-marketing, events, facebook, google-ads, hacker-news, influencers,
 *   instagram, linkedin, linkedin-ads, meta-ads, newsletter, partnerships,
 *   pinterest, press-pr, product-hunt, reddit, referral-program, seo, slack,
 *   threads, tiktok, tiktok-ads, twitter, twitter-ads, word-of-mouth, youtube,
 *   youtube-ads
 *
 * techStack (72): anthropic, astro, aws, bubble, capacitor, clerk, clickhouse,
 *   cloudflare, csharp, css, datadog, digitalocean, django, docker, dotnet,
 *   elasticsearch, electron, expo, express, fastapi, firebase, flutter, framer,
 *   gcp, github-actions, go, graphql, hetzner, html5, java, javascript, jquery,
 *   kotlin, laravel, mongodb, mysql, nextjs, nodejs, nuxt, objective-c, openai,
 *   paypal, php, postgresql, prisma, python, rabbitmq, rails, railway, react,
 *   reactnative, redis, remix, render, resend, revenuecat, rust, sendgrid,
 *   sentry, shopify, sqlite, stripe, supabase, svelte, swift, swiftui,
 *   tailwindcss, twilio, typescript, vercel, vue, webflow
 *
 * Groups nobody classifies on yet, if you want to build a rule: community
 * (discord, slack, reddit, hacker-news, product-hunt — 2% of founders),
 * outbound (cold-email, cold-dm, cold-calling — 1%), word of mouth
 * (referral-program, affiliate, word-of-mouth — 4%), mobile (swift, swiftui,
 * kotlin, flutter, reactnative, expo, capacitor — 11%), no-code (bubble,
 * webflow, framer — 4%).
 */
export const SEO_CHANNELS: readonly string[] = ['seo', 'content-marketing']

/** Acquisition you pay for, per click or per post. */
export const PAID_CHANNELS: readonly string[] = [
  'google-ads',
  'meta-ads',
  'facebook',
  'tiktok-ads',
  'twitter-ads',
  'youtube-ads',
  'linkedin-ads',
  'influencers',
]

/** Acquisition that runs on an audience the founder built themselves. */
export const AUDIENCE_CHANNELS: readonly string[] = [
  'twitter',
  'youtube',
  'tiktok',
  'instagram',
  'linkedin',
  'threads',
  'pinterest',
  'newsletter',
  'email-marketing',
  'blog',
]

/** Only two of these exist in the vocabulary. The rest were invented. */
export const AI_STACK: readonly string[] = ['openai', 'anthropic']

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
 *
 * ---------------------------------------------------------------------------
 * Built against the real corpus, not against intuition. Field coverage over
 * 200 startups / 135 founders, measured 2026-08-08:
 *
 *   activeSubscriptions > 0 ... 78%     techStack ............... 45%
 *   mrr > 0 ................... 79%     marketingChannels ....... 22%
 *   domainRating .............. 62%     customers > 0 ........... 16%
 *                                       cofounders ............... 3%
 *
 * The first tree leaned on `customers`, which exists 16% of the time, so 66%
 * of founders came out Adventurer — a ladder where two thirds of people are in
 * the "we don't know" class is not a game. The rules below lead with the
 * signals that actually exist, and `effectiveCustomers` falls back to
 * activeSubscriptions, which takes the base-size signal from 16% to 78%.
 *
 * Resulting spread: Hunter 24%, Monk 17%, Warrior 17%, Paladin 13%, Rogue 10%,
 * Warlock 7%, Mage 4%, Priest 4%, Bard 2%, Adventurer 1%.
 * ---------------------------------------------------------------------------
 */
export interface ClassRule {
  class: CharacterClass
  /** Why this class, in one sentence, displayable on the sheet. */
  reason: string
  /**
   * The same rule in words, for /rules. It lives beside the predicate on
   * purpose: a contributor who changes a threshold has to walk past the
   * sentence that describes it, which is the only thing that keeps the public
   * explanation honest.
   */
  condition: string
  test: (a: FounderAggregate, ctx: { level: number; arpu: number }) => boolean
}

const hasAny = (values: string[], group: readonly string[]) => values.some((v) => group.includes(v))

export const CLASS_RULES: readonly ClassRule[] = [
  {
    class: 'Adventurer',
    reason: 'Where everything starts.',
    condition: 'No products yet, or below level 5',
    test: (a, { level }) => a.nProducts === 0 || level < 5,
  },
  // --- How they build, then how they get customers. Both are chosen; the
  // --- price and size of the business follow from them.
  {
    class: 'Mage',
    reason: 'Building with whatever just shipped.',
    condition: 'Builds on openai or anthropic',
    test: (a) => hasAny(a.stack, AI_STACK),
  },
  {
    class: 'Hunter',
    // A domain rating of 50 is not something you drift into. It is the same
    // threshold the Authority achievement uses, on purpose.
    reason: 'Found before they go looking.',
    condition: 'An SEO channel with domain rating 30+, or domain rating 50 on its own',
    test: (a) =>
      (hasAny(a.channels, SEO_CHANNELS) && (a.domainRating ?? 0) >= 30) ||
      (a.domainRating ?? 0) >= 50,
  },
  {
    class: 'Warlock',
    reason: 'Summons customers, and pays for every one.',
    condition: 'Buys acquisition: search, social or influencer ads',
    test: (a) => hasAny(a.channels, PAID_CHANNELS),
  },
  {
    class: 'Bard',
    reason: 'Their audience is their channel.',
    condition: 'Runs on an audience they built — X, YouTube, a newsletter',
    test: (a) => hasAny(a.channels, AUDIENCE_CHANNELS),
  },
  // --- Then the shape of the business itself.
  {
    class: 'Priest',
    reason: 'Their customers stay.',
    condition: 'Measured retention above 60% across more than 50 customers',
    test: (a) => a.hasRetentionSignal && a.retention > 0.6 && a.customers > 50,
  },
  {
    class: 'Monk',
    // Real lifetime revenue and no recurring revenue at all. That is a business
    // model, not missing data — Gumroad lands here, and so does every
    // boilerplate and template seller. Phrased as independence, because that is
    // what it is: nothing to renew, nothing to churn.
    reason: 'Takes no rent. Every sale is finished the day it happens.',
    condition: 'Real lifetime revenue and no recurring revenue at all',
    test: (a) => a.mrrUsd === 0 && a.revenueTotalUsd > 0,
  },
  {
    class: 'Rogue',
    reason: 'Few marks, big scores.',
    condition: '$300 or more per customer per month',
    test: (a, { arpu }) => a.effectiveCustomers > 0 && arpu >= 300,
  },
  {
    class: 'Warrior',
    reason: 'Volume, earned one dollar at a time.',
    condition: '100+ paying, under $30 each',
    test: (a, { arpu }) => a.effectiveCustomers >= 100 && arpu < 30,
  },
  {
    class: 'Paladin',
    // The bread-and-butter bootstrapped SaaS: a real base at a sustainable
    // price, no single flashy signal. It had no class at all before, which is
    // how the most ordinary founder on the ladder ended up labelled "we don't
    // know".
    reason: 'Holds the line. A real base at a price that lasts.',
    condition: '10+ paying, $30 or more each',
    test: (a, { arpu }) => a.effectiveCustomers >= 10 && arpu >= 30,
  },
]

/** Safety net: never demeaning, always reachable. */
export const DEFAULT_CLASS: CharacterClass = 'Adventurer'

/**
 * One sentence per class, for the sheet to say why it landed there.
 *
 * The reasons were written with the rules and then never shown, which is the
 * wrong way round for a project whose answer to "why did you call me that" is
 * supposed to be "the formula is public, go read it". First rule wins, matching
 * the tree: Adventurer appears twice and the opening line is the one that
 * describes it.
 */
export const CLASS_REASONS: ReadonlyMap<CharacterClass, string> = new Map(
  CLASS_RULES.map((rule) => [rule.class, rule.reason] as const).reverse(),
)

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
