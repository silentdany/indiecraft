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

import type { AchievementDef, CharacterClass, Faction, FounderAggregate, Rarity } from './types'

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
 * ---------------------------------------------------------------------------
 * Retuned 2026-08-10, when the crawler stopped seeing only the top 200.
 *
 * Those 200 were the best-documented listings on TrustMRR, and the tree had
 * quietly been fitted to them. Against the rest of the corpus it fell apart:
 * Adventurer — the class of insufficient data, tuned down to 1% — went straight
 * back to 26%, because only 5 of 77 such listings report a marketing channel at
 * all and four of the ten rules key off channels or domain rating.
 *
 * The floors were the larger half of the problem. 45 of those 76 founders had
 * real MRR and a real customer count; they were rejected for having fewer than
 * ten. Four subscribers at $139 is a business, and the tree called it unknown.
 *
 * Two changes, both measured against the live corpus rather than guessed: the
 * base-size floors came down (see PALADIN_MIN_CUSTOMERS), and Ranger was added
 * as the last rule that can see anything — because "we don't know" is the wrong
 * answer for somebody with money coming in.
 *
 * Resulting spread over 619 founders: Monk 23%, Ranger 16%, Adventurer 15%,
 * Paladin 9%, Mage 8%, Warrior 8%, Hunter 7%, Bard 6%, Warlock 3%, Rogue 3%,
 * Priest 1%.
 *
 * Adventurer is now exactly what it claims to be: 93 founders who have shipped
 * something and earned nothing yet. Worth watching as coverage grows — Monk is
 * the largest class because a listing with lifetime revenue and no MRR lands
 * there, and in the tail that is a great many of them.
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

/**
 * How small a paying base can be and still count as one.
 *
 * These were 10 and 100, chosen against a corpus that turned out to be the top
 * 200 listings by rank — every business in it was already big. Reading the rest
 * of TrustMRR brought in founders with four subscribers at $139, and the tree
 * had nothing to say about them: not enough customers for Paladin, not cheap
 * enough for Warrior, not expensive enough for Rogue.
 *
 * Lowered against the real spread rather than by feel. Nobody moves down —
 * these floors only widen, so every change is somebody leaving Adventurer.
 */
const PALADIN_MIN_CUSTOMERS = 3
const WARRIOR_MIN_CUSTOMERS = 25

export const CLASS_RULES: readonly ClassRule[] = [
  {
    class: 'Adventurer',
    reason: 'Where everything starts.',
    // Two ways in, and the second one is where nearly everybody arrives. This
    // rule almost never fires: a single product grants 500 XP, which is level
    // 17, so `level < 5` is unreachable for anyone with something shipped. The
    // count on /rules comes from the fallback at the end of the tree, and since
    // Ranger now takes everyone with revenue, the fallback means exactly one
    // thing — shipped, earning nothing yet.
    condition: 'No products yet, or nothing earned yet',
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
    condition: '25+ paying, under $30 each',
    test: (a, { arpu }) => a.effectiveCustomers >= WARRIOR_MIN_CUSTOMERS && arpu < 30,
  },
  {
    class: 'Paladin',
    // The bread-and-butter bootstrapped SaaS: a real base at a sustainable
    // price, no single flashy signal. It had no class at all before, which is
    // how the most ordinary founder on the ladder ended up labelled "we don't
    // know".
    reason: 'Holds the line. A real base at a price that lasts.',
    condition: '3+ paying, $30 or more each',
    test: (a, { arpu }) => a.effectiveCustomers >= PALADIN_MIN_CUSTOMERS && arpu >= 30,
  },
  {
    class: 'Ranger',
    // The last rule that can see anything. Everyone here is earning; what the
    // corpus does not say is the shape of it — a handful of customers, or a
    // price too low to read as either volume or premium, or a listing with
    // revenue and no customer count at all.
    //
    // "We don't know" is the wrong answer for somebody with money coming in,
    // and it was the answer they got until the crawler saw past the top 200.
    reason: 'Earning already, and still finding the shape of it.',
    condition: 'Real revenue that the rules above cannot yet place',
    test: (a) => a.revenueTotalUsd > 0 || a.mrrUsd > 0,
  },
]

/**
 * One colour per class.
 *
 * Drawn here, not sampled: the reference's class colours are its own, and this
 * palette is built for a warm black background it never had to sit on. What is
 * borrowed is the idea — that a class is a colour before it is a word, so a
 * ladder of a hundred rows can be read by hue alone.
 *
 * The rule that keeps this from fighting the rarity palette, which is also
 * colour and also everywhere: rarity is saturated, classes are soft. Both
 * appear in the same ladder row, a level square beside a class name, and the
 * eye separates them by intensity before it separates them by hue. Break that
 * and epic purple becomes indistinguishable from a Warlock.
 *
 * Amber (roughly 40–60°) is missing on purpose. It belongs to the interface and
 * to the character's own name, and a class wearing it would read as a button.
 * Paladin, the most ordinary class on the ladder and the one that would have
 * claimed it, gets plate silver instead.
 */
export const CLASS_COLORS: Record<CharacterClass, string> = {
  /** Dim bronze: deliberately the least saturated. It is the class of no answer yet. */
  Adventurer: '#8f8069',
  /** Arcane blue, the oldest colour in the genre for the one who builds with new things. */
  Mage: '#63a8f2',
  /** Green: found without looking, the colour of things that grow on their own. */
  Hunter: '#84c65a',
  /** Orchid, pushed pinker than epic purple so the two never trade places. */
  Warlock: '#bb7cf0',
  /** Stage magenta. Their audience is the channel. */
  Bard: '#df7fd0',
  /** Ice: calm, and the class whose customers stay. */
  Priest: '#79cfd8',
  /** Jade. Takes no rent. */
  Monk: '#4ccfa0',
  /** Blood rose: few marks, big scores. */
  Rogue: '#e06a80',
  /** Rust: volume, earned a dollar at a time. */
  Warrior: '#dd8b5e',
  /** Plate silver. Holds the line, and never mistakes itself for gold. */
  Paladin: '#b6c0cb',
  /** Periwinkle: the one hue the other ten left free, for the newest class. */
  Ranger: '#8f93d6',
}

/** Safety net: never demeaning, always reachable. */
export const DEFAULT_CLASS: CharacterClass = 'Adventurer'

// ---------------------------------------------------------------------------
// 6b. Factions and realms — who you sell to, and where you build
// ---------------------------------------------------------------------------

/**
 * The two factions, and the third that refuses to pick.
 *
 * TrustMRR's `businessType` splits the corpus almost exactly in half — 59 B2B
 * against 56 B2C — which is the rarest thing a field can do and the reason this
 * became a faction rather than another chip. It is also the fact that changes
 * how you read every other number: $200 a month is a bargain from one side of
 * the line and a fortune from the other, so ARPU and retention mean opposite
 * things depending on which side a founder stands.
 *
 * The label stays "B2B", not a fantasy name. The armory can be a game about
 * real businesses without making people translate it back.
 */
export interface FactionDef {
  key: Faction
  /** Two words on what standing here actually means. */
  tagline: string
  color: string
}

/*
 * Cool, warm, and the one in between — a deliberately smaller idea than the
 * class wheel, because there are only three of them and the pair is the whole
 * message.
 *
 * None of the three may sit near amber. The first pass put B2C at #e0954f and
 * it landed a few degrees off the interface gold, so a faction name read as a
 * button next to its own count. Sharing a hue *family* with a class is fine and
 * unavoidable at ten classes — B2B is a cousin of Mage's blue — because the two
 * never occupy the same slot: a class is a word in one column, a faction is a
 * sigil in another. Sitting near the interface colour is not fine, because that
 * one does share slots with everything.
 */
export const FACTIONS: readonly FactionDef[] = [
  { key: 'B2B', tagline: 'Sells to businesses', color: '#4f9ae8' },
  { key: 'B2C', tagline: 'Sells to people', color: '#ef7f5c' },
  // Not a hedge: serving both is a genuinely harder position to hold, and the
  // ten founders who do it should not be filed under "unknown".
  { key: 'Both', tagline: 'Sells to both', color: '#38c8b4' },
]

export const FACTIONS_BY_KEY: ReadonlyMap<Faction, FactionDef> = new Map(
  FACTIONS.map((f) => [f.key, f] as const),
)

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
    progress: (p) => ({ current: p.revenueTotalUsd, target: 1 }),
  },
  {
    code: 'the_thousand',
    label: 'The Thousand',
    description: '$1,000 in lifetime revenue.',
    test: (a) => a.revenueTotalUsd >= 1_000,
    progress: (p) => ({ current: p.revenueTotalUsd, target: 1_000 }),
  },
  {
    code: 'ramen',
    label: 'Ramen Profitable',
    description: '$1,000 in MRR.',
    test: (a) => a.mrrUsd >= 1_000,
    progress: (p) => ({ current: p.mrrUsd, target: 1_000 }),
  },
  {
    code: 'raid_boss',
    label: 'Raid Boss Slayer',
    description: '$10,000 in MRR.',
    test: (a) => a.mrrUsd >= 10_000,
    progress: (p) => ({ current: p.mrrUsd, target: 10_000 }),
  },
  {
    code: 'hundred_customers',
    label: 'Centurion',
    description: '100 customers.',
    test: (a) => a.customers >= 100,
    progress: (p) => ({ current: p.customers, target: 100 }),
  },
  {
    code: 'thousand_customers',
    label: 'Legion',
    description: '1,000 customers.',
    test: (a) => a.customers >= 1_000,
    progress: (p) => ({ current: p.customers, target: 1_000 }),
  },
  {
    code: 'multiboxer',
    label: 'Multiboxer',
    description: 'Three products shipped.',
    test: (a) => a.nProducts >= 3,
    progress: (p) => ({ current: p.nProducts, target: 3 }),
  },
  {
    code: 'alt_king',
    label: 'Alt King',
    description: 'Five products shipped.',
    test: (a) => a.nProducts >= 5,
    progress: (p) => ({ current: p.nProducts, target: 5 }),
  },
  {
    code: 'unkillable',
    label: 'Unkillable',
    description: '80% retention across at least 50 customers.',
    test: (a) => a.retention >= 0.8 && a.customers >= 50,
    /*
     * Two conditions, so the bar has to track whichever one is actually
     * blocking. Reporting 5,784 customers against a floor of 50 read as "done"
     * for a founder sitting at 11% retention, which is the opposite of true.
     */
    progress: (p) => {
      if (!p.hasRetentionSignal) return null
      if (p.customers < 50) return { current: p.customers, target: 50 }
      return { current: Math.round(p.retention * 100), target: 80 }
    },
  },
  {
    code: 'ascension',
    label: 'Ascension',
    description: '+20% MRR over thirty days.',
    test: (a) => a.growthMrr30d >= 20,
    progress: (p) => ({ current: Math.max(p.growthMrr30d, 0), target: 20 }),
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
    progress: (p) => ({ current: p.domainRating ?? 0, target: 50 }),
  },
  {
    code: 'ding_sixty',
    label: 'Ding 60',
    description: 'Max level.',
    test: (_a, level) => level >= MAX_LEVEL,
    progress: (p) => ({ current: p.level, target: MAX_LEVEL }),
  },
]

export const ACHIEVEMENTS_BY_CODE = new Map(ACHIEVEMENTS.map((a) => [a.code, a]))
