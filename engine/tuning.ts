/**
 * ============================================================================
 *  THE ONLY TUNABLE FILE IN THE PROJECT
 * ============================================================================
 *
 * Level thresholds, rarity bands, the class decision tree, achievement
 * definitions, the equipment table. Nothing else. The rest of the engine is
 * plumbing that reads this file.
 *
 * This is an architectural constraint, not a style preference: the project is
 * open source, and these five objects are exactly what people will want to
 * argue about. A contributor must be able to propose a rebalance by touching
 * one file. If you have to edit anything else to rebalance, the engine has a
 * bug.
 */

import type {
  AchievementDef,
  ArmorType,
  CharacterClass,
  EquipmentGlyph,
  Faction,
  FounderAggregate,
  OffHandKind,
  Rarity,
  RarityName,
  SlotDef,
  WeaponFamily,
} from './types'

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
// 3. Item levels
// ---------------------------------------------------------------------------

/**
 * What an item of each quality is worth, as an item level.
 *
 * The bands are contiguous and cover 1–60, so a piece's quality can be read off
 * its number and back again. Inside a band the value interpolates on how far
 * the stat has climbed toward the next rung — a domain rating of 51 and one of
 * 69 are both epic Linkheart Helms, and the second is a better one.
 *
 * Legendary gets the narrowest band on purpose. Once a stat clears the top
 * threshold the ladder has nothing left to say, and stretching three points
 * across the whole open-ended tail would reward a founder at $10M MRR over one
 * at $200K for a difference the rest of the sheet already states plainly.
 */
export const ITEM_LEVEL_BANDS: Record<RarityName, { from: number; to: number }> = {
  common: { from: 1, to: 14 },
  uncommon: { from: 15, to: 29 },
  rare: { from: 30, to: 44 },
  epic: { from: 45, to: 57 },
  legendary: { from: 58, to: 60 },
}

/**
 * How far above the top rung a stat has to climb to max its band.
 *
 * Only reachable in the legendary tier, which has no next threshold to
 * interpolate against. Tripling is the whole span: $300K MRR is item level 60
 * and so is $30M, because both are "the best weapon in the game" and the card
 * has other places to say how far past it somebody is.
 */
export const ITEM_LEVEL_TOP_SPAN = 3

// ---------------------------------------------------------------------------
// 4. Rarity — indexed on the founder's level
// ---------------------------------------------------------------------------

/**
 * The item colours, and they are the reference's, not an approximation of them.
 *
 * Common is WHITE. It was #9d9d9d for a long time, which is a real colour in
 * the palette but the wrong one — that is POOR, the grey the game paints on
 * vendor trash and on nothing at all. Two consequences, both bad: a common item
 * wore the colour of worthless, and once empty slots started rendering a greyed
 * silhouette there was no longer any way to tell a common piece from an empty
 * square at a glance.
 *
 * Poor is not a tier here, so the grey is free — it now means exactly one
 * thing, which is "no item", and white means the bottom rung of five. That is
 * the reference's own distinction and it is the one that was missing.
 *
 * This adds a third deliberate collision to the two CLASS_COLORS already
 * documents: common white is also Priest white. They never occupy the same
 * slot — a class is a word in an identity line, a quality is an item name in a
 * grid — and the reference lives with exactly the same overlap.
 */
export const RARITY_BANDS: readonly { minLevel: number; rarity: Rarity }[] = [
  { minLevel: 55, rarity: { name: 'legendary', hex: '#ff8000' } },
  { minLevel: 40, rarity: { name: 'epic', hex: '#a335ee' } },
  { minLevel: 25, rarity: { name: 'rare', hex: '#0070dd' } },
  { minLevel: 10, rarity: { name: 'uncommon', hex: '#1eff00' } },
  { minLevel: 1, rarity: { name: 'common', hex: '#ffffff' } },
]

/**
 * The same five colours, addressable by name.
 *
 * A level looks its rarity up by number; an achievement carries the name
 * outright, because how hard a badge is has nothing to do with anybody's level.
 * One palette either way — the point of a quality colour is that it means the
 * same thing everywhere it appears.
 */
export const RARITY_BY_NAME: ReadonlyMap<RarityName, Rarity> = new Map(
  RARITY_BANDS.map((b) => [b.rarity.name as RarityName, b.rarity]),
)

/** Gold when a code is unknown, which only happens for a retired achievement. */
export function achievementRarityHex(rarity: RarityName | undefined): string {
  return (rarity && RARITY_BY_NAME.get(rarity)?.hex) || '#f8b700'
}

// ---------------------------------------------------------------------------
// 5. TrustMRR vocabularies
// ---------------------------------------------------------------------------

/**
 * The real vocabularies, taken from a full crawl on 2026-08-08 rather than
 * guessed. `pnpm crawl --dump-slugs` reprints them.
 *
 * The guessed lists were worse than useless: they contained `x-twitter`, which
 * does not exist — the slug is `twitter` — so the audience rule matched nothing at
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
 * base-size floors came down (see PALADIN_MIN_CUSTOMERS), and Evoker was added
 * as the last rule that can see anything — because "we don't know" is the wrong
 * answer for somebody with money coming in.
 *
 * Resulting spread over 619 founders: Monk 23%, Evoker 16%, Adventurer 15%,
 * Paladin 9%, Mage 8%, Warrior 8%, Hunter 7%, Shaman 6%, Warlock 3%, Rogue 3%,
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
    // Evoker now takes everyone with revenue, the fallback means exactly one
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
    class: 'Shaman',
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
    class: 'Evoker',
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
 * The canonical class colours, and the canonical classes.
 *
 * An earlier version invented both: a soft palette of our own, plus Bard and
 * Ranger, which are not classes anybody has ever played. That was the wrong
 * call. These thirteen hexes are the single most recognised piece of shared
 * vocabulary the genre has — every armory, every log site, every addon uses
 * them, and somebody who plays reads "Mage" off #3FC7EB before the word
 * arrives. Inventing a palette threw away the one thing that needed no
 * explaining, in exchange for tidiness nobody asked for.
 *
 * They are values, not assets: thirteen numbers that function as names. The
 * no-Blizzard-assets rule is about fonts, icons and images, and it still holds
 * everywhere — every glyph in this project is drawn here.
 *
 * Two collisions with the rarity palette are real and deliberate, because
 * fidelity beats tidiness for both:
 *
 *   Rogue #FFF468 is the butter yellow otherwise reserved for a character's own
 *   name. On a sheet they are far apart; on a ladder row a Rogue's class label
 *   wears the name colour. That is what a Rogue looks like.
 *
 *   Shaman #0070DD is exactly the rare-quality blue. A level-25-to-39 Shaman
 *   shows the same blue twice in one row, in a square and in a word.
 *
 * Adventurer is not a class in the reference either — it is the state of having
 * none yet — so it keeps a bronze that sits outside the palette rather than
 * pretending to belong.
 */
export const CLASS_COLORS: Record<CharacterClass, string> = {
  /** Not a class in the reference at all — the state of having none yet. Bronze
      keeps it out of the palette below rather than pretending to belong. */
  Adventurer: '#8f8069',
  Mage: '#3FC7EB',
  Hunter: '#AAD372',
  Warlock: '#8788EE',
  Shaman: '#0070DD',
  Priest: '#FFFFFF',
  Monk: '#00FF98',
  Rogue: '#FFF468',
  Warrior: '#C69B6D',
  Paladin: '#F48CBA',
  Evoker: '#33937F',
}

/**
 * The class emblems, borrowed rather than drawn.
 *
 * Ten of the eleven are the reference's own `classicon_*`, which is the most
 * recognisable single picture each class has — a player reads Mage off it
 * faster than off the word, which is the entire argument for using them.
 *
 * Adventurer has no emblem to borrow, being the state of having no class yet.
 * It gets a map: the journey before anybody has picked a direction, and the
 * same idea the drawn compass behind it already carries.
 */
export const CLASS_ICONS: Record<CharacterClass, string> = {
  Adventurer: 'inv_misc_map_01',
  Mage: 'classicon_mage',
  Hunter: 'classicon_hunter',
  Warlock: 'classicon_warlock',
  Shaman: 'classicon_shaman',
  Priest: 'classicon_priest',
  Monk: 'classicon_monk',
  Rogue: 'classicon_rogue',
  Warrior: 'classicon_warrior',
  Paladin: 'classicon_paladin',
  Evoker: 'classicon_evoker',
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
  /** Blizzard icon slug: the PvP banners, which is what a faction has always been. */
  icon: string
  /** Two words on what standing here actually means. */
  tagline: string
  color: string
}

/*
 * The two factions, in the two colours the word "faction" already means: blue
 * for the one that answers to institutions, red for the one that sells to
 * people. Nobody who has played the game needs the mapping explained, and it is
 * the same joke the rest of the site is telling.
 *
 * Neither is the crest colour. Horde red is #B30000 and Alliance blue is
 * #0078FF, and on #170e09 those measure 2.6:1 and 4.7:1 — the red is unreadable
 * at the 13px this is actually set in. Both are lifted until they clear 4.5:1
 * against the page, which keeps the hue and buys the legibility. Colour naming
 * a real thing has to survive being small.
 *
 * Neutral is the third, and it is the one place the game's own answer does not
 * transfer: neutral in WoW is yellow, and yellow here is the interface. So it
 * is parchment — clearly not either side, clearly not amber, and light enough
 * not to be mistaken for the muted grey that means "no data".
 *
 * Sharing a hue *family* with a class is fine and unavoidable at ten classes —
 * B2B is a cousin of Mage's blue — because the two never occupy the same slot:
 * a class is a word in one column, a faction is a sigil in another.
 */
export const FACTIONS: readonly FactionDef[] = [
  /*
   * The two PvP banners, and they land the same way round as the colours
   * already did: Alliance for the side that answers to institutions, Horde for
   * the side that sells to people.
   *
   * The slugs are named by number, not by faction, so which is which was
   * checked by looking at the two files rather than assumed:
   * `inv_bannerpvp_01` is the red Horde sigil and `inv_bannerpvp_02` is the
   * blue-and-gold Alliance lion. Swapping them would be invisible to every
   * test here and obvious to every player.
   */
  { key: 'B2B', icon: 'inv_bannerpvp_02', tagline: 'Sells to businesses', color: '#3b8ae0' },
  { key: 'B2C', icon: 'inv_bannerpvp_01', tagline: 'Sells to people', color: '#e04b45' },
  /*
   * Not a hedge: serving both is a genuinely harder position to hold, and the
   * ten founders who do it should not be filed under "unknown".
   *
   * `inv_bannerpvp_03` completes the set — the same banner as the other two, a
   * third colour, belonging to neither side. The first attempt was
   * `inv_misc_tournaments_banner_human`, which is a HUMAN tournament banner and
   * so wears Alliance livery: a neutral faction flying one side's colours is
   * worse than no picture at all. Checked by opening the file, like the other
   * two — these slugs are numbered, not named.
   */
  { key: 'Both', icon: 'inv_bannerpvp_03', tagline: 'Sells to both', color: '#c9bba0' },
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
 *
 * Every threshold here was set against the live corpus rather than picked for
 * roundness, and the share of 1,157 founders holding each one is recorded
 * beside it. A badge nobody can earn is decoration; a badge everybody has is
 * wallpaper. The two useful bands are roughly 1% — worth screenshotting — and
 * roughly 15% — worth working toward.
 *
 * The one exception is `realm_first`, which is not a property of a founder and
 * cannot be tested here: it depends on everybody else's level. It is awarded in
 * lib/compute.ts once the ladder exists, and appears in this list only so the
 * sheet knows its name and description.
 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    code: 'first_blood',
    icon: 'inv_misc_gem_bloodstone_01',
    /** 76.1% of the corpus. */
    rarity: 'common',
    label: 'First Blood',
    description: 'The first dollar earned.',
    test: (a) => a.revenueTotalUsd >= 1,
    progress: (p) => ({ current: p.revenueTotalUsd, target: 1 }),
  },
  {
    code: 'the_thousand',
    icon: 'inv_misc_coin_02',
    /** 41.3% of the corpus. */
    rarity: 'common',
    label: 'The Thousand',
    description: '$1,000 in lifetime revenue.',
    test: (a) => a.revenueTotalUsd >= 1_000,
    progress: (p) => ({ current: p.revenueTotalUsd, target: 1_000 }),
  },
  // The XP axis had exactly two rungs, $1 and $1,000, on a site whose entire
  // scoring spine is lifetime revenue. Three more, to the top of the corpus.
  {
    code: 'ten_thousand',
    icon: 'inv_misc_coin_01',
    /** 24.3% of the corpus. */
    rarity: 'uncommon',
    label: 'Ten Thousand',
    description: '$10,000 in lifetime revenue.',
    test: (a) => a.revenueTotalUsd >= 10_000,
    progress: (p) => ({ current: p.revenueTotalUsd, target: 10_000 }),
  },
  {
    code: 'exalted',
    icon: 'achievement_reputation_08',
    /** 14.1% of the corpus. */
    rarity: 'rare',
    label: 'Exalted',
    description: '$100,000 in lifetime revenue.',
    test: (a) => a.revenueTotalUsd >= 100_000,
    progress: (p) => ({ current: p.revenueTotalUsd, target: 100_000 }),
  },
  {
    code: 'the_million',
    icon: 'inv_misc_coinbag_special',
    /** 4.7% of the corpus. */
    rarity: 'epic',
    label: 'The Million',
    description: '$1,000,000 in lifetime revenue.',
    test: (a) => a.revenueTotalUsd >= 1_000_000,
    progress: (p) => ({ current: p.revenueTotalUsd, target: 1_000_000 }),
  },
  {
    code: 'ramen',
    icon: 'inv_misc_food_15',
    /** 16.5% of the corpus. */
    rarity: 'uncommon',
    label: 'Ramen Profitable',
    description: '$1,000 in MRR.',
    test: (a) => a.mrrUsd >= 1_000,
    progress: (p) => ({ current: p.mrrUsd, target: 1_000 }),
  },
  {
    code: 'raid_boss',
    icon: 'achievement_boss_ragnaros',
    /** 9.3% of the corpus. */
    rarity: 'rare',
    label: 'Raid Boss Slayer',
    description: '$10,000 in MRR.',
    test: (a) => a.mrrUsd >= 10_000,
    progress: (p) => ({ current: p.mrrUsd, target: 10_000 }),
  },
  {
    code: 'mythic',
    icon: 'achievement_challengemode_gold',
    /** 1.4% of the corpus. */
    rarity: 'epic',
    label: 'Mythic',
    description: '$100,000 in MRR.',
    test: (a) => a.mrrUsd >= 100_000,
    progress: (p) => ({ current: p.mrrUsd, target: 100_000 }),
  },
  {
    // One founder in the corpus holds this. That is the point of a top rung:
    // it is not aspirational decoration, somebody is actually up there.
    code: 'legendary',
    icon: 'inv_misc_head_dragon_01',
    /** 0.1% of the corpus. */
    rarity: 'legendary',
    label: 'Legendary',
    description: '$1,000,000 in MRR.',
    test: (a) => a.mrrUsd >= 1_000_000,
    progress: (p) => ({ current: p.mrrUsd, target: 1_000_000 }),
  },
  {
    code: 'hundred_customers',
    icon: 'achievement_reputation_01',
    /** 3.2% of the corpus. */
    rarity: 'epic',
    label: 'Centurion',
    description: '100 customers.',
    test: (a) => a.customers >= 100,
    progress: (p) => ({ current: p.customers, target: 100 }),
  },
  {
    code: 'thousand_customers',
    icon: 'achievement_reputation_06',
    /** 1.6% of the corpus. */
    rarity: 'epic',
    label: 'Legion',
    description: '1,000 customers.',
    test: (a) => a.customers >= 1_000,
    progress: (p) => ({ current: p.customers, target: 1_000 }),
  },
  {
    code: 'multiboxer',
    icon: 'achievement_guildperk_everybodysfriend',
    /** 1.2% of the corpus. */
    rarity: 'epic',
    label: 'Multiboxer',
    description: 'Three products shipped.',
    test: (a) => a.nProducts >= 3,
    progress: (p) => ({ current: p.nProducts, target: 3 }),
  },
  {
    code: 'alt_king',
    icon: 'achievement_guildperk_workingovertime',
    /** 0.3% of the corpus. */
    rarity: 'legendary',
    label: 'Alt King',
    description: 'Five products shipped.',
    test: (a) => a.nProducts >= 5,
    progress: (p) => ({ current: p.nProducts, target: 5 }),
  },
  {
    code: 'unkillable',
    icon: 'ability_warrior_shieldwall',
    /** 0.8% of the corpus. */
    rarity: 'legendary',
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
    icon: 'ability_rogue_sprint',
    /** 8.2% of the corpus. */
    rarity: 'rare',
    label: 'Ascension',
    description: '+20% MRR over thirty days.',
    test: (a) => a.growthMrr30d >= 20,
    progress: (p) => ({ current: Math.max(p.growthMrr30d, 0), target: 20 }),
  },
  {
    code: 'bloodlust',
    icon: 'spell_nature_bloodlust',
    /** 2.9% of the corpus. */
    rarity: 'epic',
    label: 'Bloodlust',
    description: 'MRR doubled over thirty days.',
    test: (a) => a.growthMrr30d >= 100,
    progress: (p) => ({ current: Math.max(p.growthMrr30d, 0), target: 100 }),
  },
  {
    code: 'veteran',
    icon: 'inv_misc_pocketwatch_01',
    /** 17.5% of the corpus. */
    rarity: 'uncommon',
    label: 'Veteran',
    description: 'Two years since the first launch.',
    test: (a) => ageInMs(a.foundedFirst) >= YEARS(2),
  },
  {
    code: 'old_guard',
    icon: 'inv_misc_pocketwatch_02',
    /** 5.1% of the corpus. */
    rarity: 'rare',
    label: 'Old Guard',
    description: 'Five years since the first launch.',
    test: (a) => ageInMs(a.foundedFirst) >= YEARS(5),
  },
  {
    code: 'classic',
    icon: 'inv_misc_pocketwatch_03',
    /** 0.9% of the corpus. */
    rarity: 'legendary',
    label: 'Classic',
    description: 'Ten years since the first launch.',
    test: (a) => ageInMs(a.foundedFirst) >= YEARS(10),
  },
  {
    code: 'lone_wolf',
    icon: 'spell_nature_spiritwolf',
    /** 98.7% of the corpus. */
    rarity: 'common',
    label: 'Lone Wolf',
    description: 'No cofounder on any product.',
    test: (a) => a.nProducts > 0 && a.cofounders.length === 0,
  },
  {
    code: 'guilded',
    icon: 'inv_shirt_guildtabard_01',
    /** 1.3% of the corpus. */
    rarity: 'epic',
    label: 'Guilded',
    description: 'At least one cofounder.',
    test: (a) => a.cofounders.length >= 1,
  },
  {
    code: 'authority',
    icon: 'inv_misc_rune_01',
    /** 4.3% of the corpus. */
    rarity: 'epic',
    label: 'Authority',
    description: 'Domain rating of 50 or above.',
    test: (a) => (a.domainRating ?? 0) >= 50,
    progress: (p) => ({ current: p.domainRating ?? 0, target: 50 }),
  },
  {
    code: 'renowned',
    icon: 'achievement_reputation_07',
    /** 1.6% of the corpus, and legendary above its band — see `rarity`. */
    rarity: 'legendary',
    label: 'Renowned',
    description: 'Domain rating of 70 or above.',
    test: (a) => (a.domainRating ?? 0) >= 70,
    progress: (p) => ({ current: p.domainRating ?? 0, target: 70 }),
  },
  {
    code: 'mercenary',
    icon: 'inv_misc_bandana_01',
    /** 4.1% of the corpus. */
    rarity: 'epic',
    label: 'Mercenary',
    // Mercenary Mode lets you fight for the other side. Selling to both is the
    // harder position to hold and the corpus says so: 47 of 1,157.
    description: 'Sells to businesses and to people.',
    test: (a) => a.faction === 'Both',
  },
  {
    code: 'ironman',
    icon: 'inv_misc_armorkit_17',
    /** 5.3% of the corpus. */
    rarity: 'rare',
    label: 'Ironman',
    description: 'No outside funding on any product.',
    // Only when funding is reported at all: silence is not a claim to have
    // bootstrapped, and this badge must never be awarded for a blank field.
    test: (a) =>
      a.fundingStatuses.length > 0 && a.fundingStatuses.every((s) => s === 'bootstrapped'),
  },
  {
    code: 'companion',
    icon: 'ability_hunter_beastcall',
    /** 13.5% of the corpus. */
    rarity: 'rare',
    label: 'Companion',
    description: 'Shipped a mobile app.',
    test: (a) => a.hasMobileApp,
  },
  {
    code: 'dual_spec',
    icon: 'achievement_general_stayclassy',
    /** 3.9% of the corpus. */
    rarity: 'epic',
    label: 'Dual Spec',
    description: 'Products in two different categories.',
    test: (a) => a.categories.length >= 2,
    progress: (p) => ({ current: p.categories, target: 2 }),
  },
  {
    code: 'tinker',
    icon: 'trade_engineering',
    /** 3.9% of the corpus. */
    rarity: 'epic',
    label: 'Tinker',
    description: 'Ten technologies or more across the stack.',
    test: (a) => a.stack.length >= 10,
    progress: (p) => ({ current: p.stackSize, target: 10 }),
  },
  {
    code: 'alchemist',
    icon: 'trade_alchemy',
    /** 17.1% of the corpus. */
    rarity: 'uncommon',
    label: 'Alchemist',
    description: '90% profit margin over thirty days.',
    test: (a) => (a.profitMargin30d ?? 0) >= 90,
    // Null is "never reported", not "zero margin", so it gets no bar rather
    // than a bar sitting at 0 of 90 — the same distinction Unkillable makes.
    progress: (p) =>
      p.profitMargin30d === null ? null : { current: p.profitMargin30d, target: 90 },
  },
  {
    code: 'server_full',
    icon: 'inv_misc_grouplooking',
    /** 2.1% of the corpus. */
    rarity: 'epic',
    label: 'Server Full',
    description: '10,000 visitors over thirty days.',
    test: (a) => a.visitors30d >= 10_000,
    progress: (p) => ({ current: p.visitors30d, target: 10_000 }),
  },
  {
    code: 'summoned',
    icon: 'spell_shadow_demonicempathy',
    /** 0.3% of the corpus. */
    rarity: 'legendary',
    label: 'Summoned',
    description: '100,000 Google impressions over thirty days.',
    test: (a) => a.googleImpressions30d >= 100_000,
    progress: (p) => ({ current: p.googleImpressions30d, target: 100_000 }),
  },
  {
    code: 'auction_house',
    icon: 'achievement_guildperk_cashflow',
    /** 24.9% of the corpus. */
    rarity: 'uncommon',
    label: 'Auction House',
    // firstListedForSaleAt, never `onSale`: the second flips back when a
    // listing is withdrawn, and an earned achievement is never lost.
    description: 'Listed a product for sale.',
    test: (a) => a.everListedForSale,
  },
  {
    code: 'clean_sweep',
    icon: 'spell_holy_championsbond',
    /** 1.4% of the corpus. */
    rarity: 'epic',
    label: 'Clean Sweep',
    description: 'Two products or more, every one of them earning.',
    test: (a) => a.allProductsEarning,
    progress: (p) => (p.nProducts < 2 ? null : { current: p.productsEarning, target: p.nProducts }),
  },
  {
    /*
     * Not tested here, and it cannot be: it depends on everybody else's level,
     * and this function sees one founder. lib/compute.ts awards it after the
     * ladder is written. The entry exists so the sheet has a name and a
     * description to render.
     *
     * Only on realms of ten or more. Without that floor there are 73 winners,
     * because 54 realms hold exactly one founder, and "first in a field of one"
     * is not an achievement — it is a rounding error with a medal.
     */
    code: 'realm_first',
    icon: 'inv_banner_02',
    /** 1.6% of the corpus, and legendary above its band — see `rarity`. */
    rarity: 'legendary',
    label: 'Realm First!',
    description: 'Highest level on a realm of ten founders or more.',
    test: () => false,
  },
  {
    code: 'ding_sixty',
    icon: 'achievement_level_60',
    /** 0.9% of the corpus. */
    rarity: 'legendary',
    label: 'Ding 60',
    description: 'Max level.',
    test: (_a, level) => level >= MAX_LEVEL,
    progress: (p) => ({ current: p.level, target: MAX_LEVEL }),
  },
]

/** Awarded by lib/compute.ts against the finished ladder, never by `test`. */
export const REALM_FIRST_CODE = 'realm_first'
/** Realms smaller than this have no contest to win. */
export const REALM_FIRST_MIN_SIZE = 10

export const ACHIEVEMENTS_BY_CODE = new Map(ACHIEVEMENTS.map((a) => [a.code, a]))

// ---------------------------------------------------------------------------
// 8. Equipment — the paper doll
// ---------------------------------------------------------------------------

/**
 * Seventeen slots. Each slot IS a stat, and the item worn in it is that stat's
 * quality made into an object you can hover.
 *
 * ---------------------------------------------------------------------------
 * Three decisions, in the order they matter.
 *
 * THE SLOT MEANS THE STAT. Main Hand is MRR because your weapon is the number
 * everything else is judged by; Back is retention because it is what covers
 * you; Ring 2 is cofounders because a ring is a bond. Not one slot was assigned
 * to fill a hole in the grid. Anybody proposing a remap should be able to
 * finish the sentence "this slot is that stat BECAUSE" — if they can't, the
 * paper doll is just a bingo card.
 *
 * THE THRESHOLDS ARE FIXED, NOT PERCENTILES. This was the tempting mistake and
 * it is the same one section 7 already refuses: a quality indexed on the corpus
 * means a founder's epic quietly turns rare while they sleep, because somebody
 * else shipped. Every `min` below is a number, calibrated once against the live
 * corpus, with the achievement share it was anchored to recorded beside it
 * where one exists. An item, once worn, is only ever taken off by the stat
 * itself falling.
 *
 * AN EMPTY SLOT IS AN ANSWER. `read` returns null when the corpus never spoke,
 * and the engine keeps that apart from "reported, but below the first rung" —
 * see EmptyReason. Two thirds of TrustMRR listings have no marketing channels
 * and half have no tech stack; dressing those founders in grey commons for
 * fields they never filled in would be the gear version of the retention
 * penalty this engine has already thrown out twice.
 *
 * ---------------------------------------------------------------------------
 * THE NAMES. Every item derives from a real Classic one, recorded in `after`.
 *
 * The rule that makes a derivation work: keep the cadence and the qualifier,
 * swap the noun. "Lionheart Helm" → "Linkheart Helm" lands because the shape
 * survives and one sound moves. "Arcanite Reaper" → "Revenue Axe" does not,
 * because nothing of the original is left to recognise.
 *
 * Two constraints on top, both inherited from the achievements:
 *
 *   Never demeaning. A name is a thing somebody screenshots about themselves.
 *   "Arcanite Refunder" was the first draft of the epic weapon and it is out —
 *   a refund is a bad day at work, and no founder should find their best month
 *   labelled with one.
 *
 *   Ascending fame. Commons derive from vendor trash nobody will place, and
 *   only the top two rungs touch items people can name. The joke has to be
 *   worth the most where it is hardest to earn.
 */

/**
 * What each class wears and what it swings.
 *
 * Straight off the reference's own armour and weapon rules, because those rules
 * are the second-most recognised piece of shared vocabulary the genre has after
 * the quality colours — a player reads "plate" and knows the answer is Warrior
 * or Paladin before any word arrives.
 *
 * Two calls worth defending:
 *
 *   Evoker wears mail, which is correct in the reference and also right here:
 *   it is the class of "earning already, still finding the shape of it", and
 *   mail is the armour of the classes that are half one thing and half another.
 *
 *   Adventurer gets cloth and a plain sword. It is not a class — it is the state
 *   of having none yet — so it gets the starting kit rather than a specialism,
 *   which is exactly what it means. Never leather or plate: those are choices,
 *   and this is the absence of one.
 */
export const CLASS_GEAR: Record<
  CharacterClass,
  { armor: ArmorType; weapon: WeaponFamily; offHand: OffHandKind }
> = {
  Warrior: { armor: 'plate', weapon: 'axe', offHand: 'shield' },
  Paladin: { armor: 'plate', weapon: 'hammer', offHand: 'shield' },
  Hunter: { armor: 'mail', weapon: 'sword', offHand: 'blade' },
  Shaman: { armor: 'mail', weapon: 'mace', offHand: 'shield' },
  Evoker: { armor: 'mail', weapon: 'staff', offHand: 'focus' },
  Rogue: { armor: 'leather', weapon: 'dagger', offHand: 'blade' },
  Monk: { armor: 'leather', weapon: 'fist', offHand: 'blade' },
  Mage: { armor: 'cloth', weapon: 'staff', offHand: 'focus' },
  Warlock: { armor: 'cloth', weapon: 'dagger', offHand: 'focus' },
  Priest: { armor: 'cloth', weapon: 'mace', offHand: 'focus' },
  Adventurer: { armor: 'cloth', weapon: 'sword', offHand: 'shield' },
}

const usd = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: v >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: v >= 10_000 ? 1 : 0,
  }).format(v)

const count = (v: number) =>
  new Intl.NumberFormat('en-US', {
    notation: v >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(v)

const percent = (v: number) => `${Math.round(v)}%`

/** Years since an ISO date, or null when there is no date to count from. */
const yearsSince = (iso: string | null): number | null =>
  iso === null ? null : (Date.now() - new Date(iso).getTime()) / YEARS(1)

/** Zero is real on some stats and "never reported" on others. This is the latter. */
const positive = (v: number): number | null => (v > 0 ? v : null)

/**
 * What an empty slot shows.
 *
 * The reference greys out a silhouette of the piece that belongs there, so an
 * empty head slot still reads as a head slot. Those are UI textures rather than
 * item icons and are not on the CDN, so this is the nearest honest equivalent:
 * the plainest real item of each shape, rendered desaturated and dimmed.
 *
 * Keyed on the glyph rather than on the slot, because that is exactly what the
 * glyph already is — the SHAPE of the thing worn — and both rings want one ring
 * and both trinkets one talisman, same as the drawings do.
 *
 * The point is that a blank slot keeps saying what it is for. A row of
 * identical question marks would be seventeen ways of saying nothing, and the
 * drawn glyph alone reads as interface furniture rather than as a gap in a
 * character.
 */
/**
 * The interface's own pictures, for the places that are not an item, a class,
 * a faction or a badge.
 *
 * Section headings, timeline events, the enchantment line. Every one of these
 * was a drawn glyph, and each was the last thing on its panel still saying "we
 * made this ourselves" beside three borrowed ones — which reads as an
 * unfinished job rather than as a decision.
 *
 * Not everything qualifies. `shuffle`, `link` and `download` in the share panel
 * stay drawn: they are browser actions, the reference has no picture for them,
 * and reaching for a vaguely-related spell icon would be decoration pretending
 * to be meaning. Same for the brand mark, which has to be ours by definition.
 */
/**
 * Our drawn stat vocabulary, translated into Blizzard's.
 *
 * Keyed on the glyph name rather than on the stat, because the same glyph
 * already stands for the same idea in three different places — the home page's
 * figures, the versus rows and the sheet. One table, and every consumer of a
 * stat glyph gets the borrowed picture without knowing this exists.
 *
 * Keys not present here simply keep their drawing, which is the correct
 * outcome for anything the reference has no word for.
 */
export const STAT_ICONS: Record<string, string> = {
  characters: 'inv_misc_grouplooking',
  level: 'achievement_level_10',
  gear: 'inv_misc_bag_10',
  revenue: 'inv_misc_coin_05',
  coins: 'inv_misc_coin_17',
  crowd: 'achievement_guildperk_mrpopularity',
  beacon: 'spell_holy_searinglight',
  banner: 'inv_banner_03',
  stack: 'inv_misc_platnumdisks',
  achievement: 'achievement_quests_completed_08',
  rising: 'spell_holy_borrowedtime',
  shieldPulse: 'ability_warrior_shieldwall',
  hourglass: 'spell_nature_timestop',
}

export const UI_ICONS = {
  /** A career: joined, levelled, earned something. */
  timelineJoined: 'inv_scroll_11',
  timelineLevel: 'achievement_level_10',
  timelineAchievement: 'achievement_quests_completed_08',
  /** How long we have been watching. */
  watched: 'spell_nature_timestop',
  /** The three stat groups. */
  statRevenue: 'inv_misc_coin_05',
  statAudience: 'achievement_guildperk_mrpopularity',
  statTrajectory: 'spell_holy_borrowedtime',
  /** Standing, and the two founders either side. */
  rank: 'achievement_arena_2v2_1',
  rivals: 'achievement_pvp_h_a',
  /** A product's tech stack, which behaves exactly like an item's enchantments. */
  enchant: 'trade_engraving',

  /*
   * The consent actions, which were five copies of the brand crest doing three
   * different jobs. Claiming a sheet is taking possession of it, so it is a
   * key; being signed in is an identity; putting a removed sheet back is
   * literally a resurrection, and the reference has a spell for that.
   */
  claim: 'inv_misc_key_03',
  signedIn: 'achievement_character_human_male',
  restore: 'spell_holy_resurrection',

  /*
   * The share panel. These were left drawn on the grounds that a browser
   * action has no counterpart in the reference, which held for the arrows and
   * chains a UI kit would use — but not for what these three actually do. A
   * different draft is a different scroll, a link handed to somebody is a
   * letter, and taking the picture away is a bag.
   */
  reword: 'inv_inscription_scroll',
  copyLink: 'inv_letter_15',
  saveCard: 'inv_misc_bag_08',
} as const

export const EMPTY_SLOT_ICONS: Record<EquipmentGlyph, string> = {
  helm: 'inv_helmet_08',
  pendant: 'inv_jewelry_necklace_01',
  pauldron: 'inv_shoulder_11',
  cloak: 'inv_misc_cape_01',
  cuirass: 'inv_chest_cloth_04',
  bracer: 'inv_bracer_02',
  gauntlet: 'inv_gauntlets_05',
  girdle: 'inv_belt_03',
  legplate: 'inv_pants_02',
  sabaton: 'inv_boots_01',
  band: 'inv_jewelry_ring_02',
  talisman: 'inv_jewelry_talisman_01',
  blade: 'inv_sword_01',
  buckler: 'inv_shield_01',
  longbow: 'inv_weapon_bow_01',
}

export const SLOTS: readonly SlotDef[] = [
  // --- Left column ---------------------------------------------------------
  {
    key: 'head',
    label: 'Head',
    stat: 'Domain rating',
    glyph: 'helm',
    read: (i) => i.domainRating,
    format: (v) => String(Math.round(v)),
    items: [
      {
        rarity: 'common',
        min: 1,
        name: 'Worn Meta Coif',
        icon: 'inv_helmet_14',
        after: 'Worn Mail Coif',
      },
      {
        rarity: 'uncommon',
        min: 10,
        name: 'Backlink Hood',
        icon: 'inv_helmet_41',
        after: 'Bloodfang Hood',
      },
      {
        rarity: 'rare',
        min: 30,
        name: 'Helm of the Indexed',
        icon: 'inv_helmet_21',
        after: 'Helm of the Lifegiver',
      },
      // The Authority achievement's threshold, on purpose: 4.3% of the corpus.
      {
        rarity: 'epic',
        min: 50,
        name: 'Linkheart Helm',
        icon: 'inv_helmet_25',
        after: 'Lionheart Helm',
      },
      // Renowned's threshold. 1.6%, and years of somebody else's links.
      {
        rarity: 'legendary',
        min: 70,
        name: 'Crown of Distribution',
        icon: 'inv_crown_02',
        after: 'Crown of Destruction',
      },
    ],
  },
  {
    key: 'neck',
    label: 'Neck',
    stat: 'Followers',
    glyph: 'pendant',
    read: (i) => positive(i.followers ?? 0),
    format: count,
    items: [
      {
        rarity: 'common',
        min: 1,
        name: 'Tarnished Reply Chain',
        icon: 'inv_jewelry_necklace_07',
        after: 'Tarnished Silver Chain',
      },
      {
        rarity: 'uncommon',
        min: 1_000,
        name: 'Pendant of the Timeline',
        icon: 'inv_jewelry_necklace_13',
        after: 'Pendant of the Agate Shield',
      },
      {
        rarity: 'rare',
        min: 10_000,
        name: 'Choker of the Feed Lord',
        icon: 'inv_jewelry_necklace_20',
        after: 'Choker of the Fire Lord',
      },
      {
        rarity: 'epic',
        min: 50_000,
        name: "Poster's Talisman of Connectivity",
        icon: 'inv_jewelry_amulet_03',
        after: "Prestor's Talisman of Connectivity",
      },
      {
        rarity: 'legendary',
        min: 250_000,
        name: 'Talisman of Ephemeral Reach',
        icon: 'inv_jewelry_necklace_28',
        after: 'Talisman of Ephemeral Power',
      },
    ],
  },
  {
    key: 'shoulders',
    label: 'Shoulders',
    stat: 'Products shipped',
    glyph: 'pauldron',
    read: (i) => positive(i.nProducts),
    format: count,
    items: [
      {
        rarity: 'common',
        min: 1,
        name: 'Rough Prototype Pads',
        icon: 'inv_shoulder_09',
        after: 'Rough Leather Shoulders',
      },
      {
        rarity: 'uncommon',
        min: 2,
        name: 'Trueship Shoulders',
        icon: 'inv_shoulder_02',
        after: 'Truestrike Shoulders',
      },
      // Multiboxer's threshold: 1.2% of the corpus ship three.
      {
        rarity: 'rare',
        min: 3,
        name: 'Mantle of the Second Domain',
        icon: 'inv_shoulder_18',
        after: 'Mantle of Lost Hope',
      },
      // Alt King's: 0.3% ship five.
      {
        rarity: 'epic',
        min: 5,
        name: "Shipmaster's Pauldrons",
        icon: 'inv_shoulder_24',
        after: "Dragonstalker's Spaulders",
      },
      {
        rarity: 'legendary',
        min: 7,
        name: 'Spaulders of the Endless Backlog',
        icon: 'inv_shoulder_29',
        after: 'Spaulders of Valor',
      },
    ],
  },
  {
    key: 'back',
    label: 'Back',
    stat: 'Retention',
    glyph: 'cloak',
    // Guarded exactly like the iLvl penalty: no retention signal is no cloak,
    // never a grey one. TrustMRR reports customers: 0 on most listings, and a
    // ratio computed from that is not a low number, it is no number.
    read: (i) => (i.hasRetentionSignal ? i.retention * 100 : null),
    format: percent,
    items: [
      {
        rarity: 'common',
        min: 1,
        name: 'Tattered Trial Cape',
        icon: 'inv_misc_cape_02',
        after: 'Tattered Cloth Cape',
      },
      {
        rarity: 'uncommon',
        min: 30,
        name: 'Cloak of Renewals',
        icon: 'inv_misc_cape_08',
        after: 'Cloak of Flames',
      },
      {
        rarity: 'rare',
        min: 50,
        name: 'Cape of the Recurring Baron',
        icon: 'inv_misc_cape_16',
        after: 'Cape of the Black Baron',
      },
      {
        rarity: 'epic',
        min: 70,
        name: 'Shroud of Subscription',
        icon: 'inv_misc_cape_18',
        after: 'Shroud of Dominion',
      },
      /*
       * Retention is bimodal and the middle bands are nearly empty because of
       * it: only 5% of the corpus reports a signal at all, and those that do
       * cluster at ~100% (activeSubscriptions equal to customers, which is
       * usually the same number twice rather than perfect retention). Epic
       * lands at 0.1% and legendary at 1.7% as a result. That inversion is a
       * property of the data, not of these numbers — moving them does not
       * create founders at 75%.
       */
      {
        rarity: 'legendary',
        min: 85,
        name: 'Cloak of the Unchurned',
        icon: 'inv_misc_cape_20',
        after: 'Cloak of the Shrouded Mist',
      },
    ],
  },
  {
    key: 'chest',
    varyBy: 'armor',
    label: 'Chest',
    stat: 'Customers',
    glyph: 'cuirass',
    // effectiveCustomers, not customers: the same fallback the class tree uses,
    // and the difference between 16% coverage and 78%.
    read: (i) => positive(i.effectiveCustomers),
    format: count,
    items: [
      {
        rarity: 'common',
        min: 1,
        name: 'Tattered Trial Vest',
        icon: 'inv_chest_cloth_01',
        after: 'Tattered Cloth Vest',
        variants: {
          cloth: {
            name: 'Tattered Trial Robe',
            after: 'Tattered Cloth Vest',
            icon: 'inv_chest_cloth_01',
          },
          leather: {
            name: 'Tattered Trial Jerkin',
            after: 'Tattered Leather Vest',
            icon: 'inv_chest_leather_01',
          },
          mail: {
            name: 'Tattered Trial Hauberk',
            after: 'Tattered Mail Vest',
            icon: 'inv_chest_chain_15',
          },
          plate: {
            name: 'Tattered Trial Breastplate',
            after: 'Tattered Plate Vest',
            icon: 'inv_chest_plate01',
          },
        },
      },
      {
        rarity: 'uncommon',
        min: 15,
        name: 'Chestguard of the Early Adopter',
        icon: 'inv_chest_chain_05',
        after: 'Chestguard of the Fallen Hero',
        variants: {
          cloth: {
            name: 'Robe of the Early Adopter',
            after: 'Robe of the Fallen Hero',
            icon: 'inv_chest_cloth_09',
          },
          leather: {
            name: 'Jerkin of the Early Adopter',
            after: 'Jerkin of the Fallen Hero',
            icon: 'inv_chest_leather_05',
          },
          mail: {
            name: 'Hauberk of the Early Adopter',
            after: 'Chestguard of the Fallen Hero',
            icon: 'inv_chest_chain_05',
          },
          plate: {
            name: 'Breastplate of the Early Adopter',
            after: 'Breastplate of the Fallen Hero',
            icon: 'inv_chest_plate05',
          },
        },
      },
      {
        rarity: 'rare',
        min: 100,
        name: 'Robe of the Arch-Renewal',
        icon: 'inv_chest_cloth_18',
        after: 'Robe of the Archmage',
        variants: {
          cloth: {
            name: 'Robe of the Arch-Renewal',
            after: 'Robe of the Archmage',
            icon: 'inv_chest_cloth_18',
          },
          leather: {
            name: 'Tunic of the Arch-Renewal',
            after: 'Tunic of the Archmage',
            icon: 'inv_chest_leather_09',
          },
          mail: {
            name: 'Chestguard of the Arch-Renewal',
            after: 'Chestguard of the Archmage',
            icon: 'inv_chest_chain_09',
          },
          plate: {
            name: 'Breastplate of the Arch-Renewal',
            after: 'Breastplate of the Archmage',
            icon: 'inv_chest_plate08',
          },
        },
      },
      // Centurion's threshold: 3.2%.
      {
        rarity: 'epic',
        min: 600,
        name: 'Breastplate of the Paid Tier',
        icon: 'inv_chest_plate06',
        after: 'Breastplate of Might',
        variants: {
          cloth: {
            name: 'Robes of the Paid Tier',
            after: 'Robes of Might',
            icon: 'inv_chest_cloth_25',
          },
          leather: {
            name: 'Vest of the Paid Tier',
            after: 'Vest of Might',
            icon: 'inv_chest_leather_03',
          },
          mail: {
            name: 'Mail of the Paid Tier',
            after: 'Mail of Might',
            icon: 'inv_chest_chain_11',
          },
          plate: {
            name: 'Breastplate of the Paid Tier',
            after: 'Breastplate of Might',
            icon: 'inv_chest_plate06',
          },
        },
      },
      // Legion's: 1.6%.
      {
        rarity: 'legendary',
        min: 3_000,
        name: 'Cuirass of the Thousandfold Base',
        icon: 'inv_chest_plate16',
        after: 'Cuirass of the Immortal',
        variants: {
          cloth: {
            name: 'Vestments of the Thousandfold Base',
            after: 'Vestments of the Immortal',
            icon: 'inv_chest_cloth_37',
          },
          leather: {
            name: 'Bootstrap Chestpiece',
            after: 'Bloodfang Chestpiece',
            icon: 'inv_chest_leather_08',
          },
          mail: {
            name: 'Hauberk of the Thousandfold Base',
            after: 'Hauberk of the Immortal',
            icon: 'inv_chest_chain_13',
          },
          plate: {
            name: 'Cuirass of the Thousandfold Base',
            after: 'Cuirass of the Immortal',
            icon: 'inv_chest_plate16',
          },
        },
      },
    ],
  },
  {
    key: 'wrist',
    label: 'Wrist',
    stat: 'Per customer',
    glyph: 'bracer',
    read: (i) => (i.effectiveCustomers > 0 ? i.mrrUsd / i.effectiveCustomers : null),
    format: usd,
    items: [
      {
        rarity: 'common',
        min: 1,
        name: 'Cuffs of the Free Tier',
        icon: 'inv_bracer_03',
        after: "Cuffs of Nature's Fury",
      },
      {
        rarity: 'uncommon',
        min: 10,
        name: 'Bracers of Modest Pricing',
        icon: 'inv_bracer_07',
        after: 'Bracers of Might',
      },
      {
        rarity: 'rare',
        min: 50,
        name: 'Wristguards of Stable Pricing',
        icon: 'inv_bracer_13',
        after: 'Wristguards of Stability',
      },
      // The Rogue rule's ARPU floor, on purpose: few marks, big scores.
      {
        rarity: 'epic',
        min: 300,
        name: 'Enterprise Armbraces',
        icon: 'inv_bracer_17',
        after: 'Battleborn Armbraces',
      },
      {
        rarity: 'legendary',
        min: 1_000,
        name: 'Bracelets of the Annual Contract',
        icon: 'inv_bracer_19',
        after: 'Bracelets of Royal Redemption',
      },
    ],
  },
  // --- Right column --------------------------------------------------------
  {
    key: 'hands',
    label: 'Hands',
    stat: 'Technologies',
    glyph: 'gauntlet',
    read: (i) => positive(i.stack.length),
    format: count,
    items: [
      {
        rarity: 'common',
        min: 1,
        name: 'Handstitched Starter Gloves',
        icon: 'inv_gauntlets_17',
        after: 'Handstitched Leather Gloves',
      },
      {
        rarity: 'uncommon',
        min: 3,
        name: 'Framework Gauntlets',
        icon: 'inv_gauntlets_29',
        after: 'Flameguard Gauntlets',
      },
      {
        rarity: 'rare',
        min: 6,
        name: 'DevOps Gauntlets',
        icon: 'inv_gauntlets_25',
        after: 'Devilsaur Gauntlets',
      },
      // Tinker's threshold: 3.9%. Edgemaster's is the best-known glove in the
      // game and "edge runtime" is a real thing people deploy to.
      {
        rarity: 'epic',
        min: 10,
        name: 'Edge Runtime Handguards',
        icon: 'inv_gauntlets_04',
        after: "Edgemaster's Handguards",
      },
      {
        rarity: 'legendary',
        min: 15,
        name: 'Gauntlets of Infinite Migrations',
        icon: 'inv_gauntlets_30',
        after: 'Sacrificial Gauntlets',
      },
    ],
  },
  {
    key: 'waist',
    label: 'Waist',
    stat: 'Profit margin',
    glyph: 'girdle',
    read: (i) => i.profitMargin30d,
    format: percent,
    items: [
      {
        rarity: 'common',
        min: 1,
        name: 'Rugged Runway Belt',
        icon: 'inv_belt_09',
        after: 'Rugged Leather Belt',
      },
      {
        rarity: 'uncommon',
        min: 50,
        name: 'Girdle of Thin Margins',
        icon: 'inv_belt_15',
        after: 'Girdle of Golden Scales',
      },
      {
        rarity: 'rare',
        min: 80,
        name: 'Girdle of Operational Fury',
        icon: 'inv_belt_23',
        after: 'Girdle of Elemental Fury',
      },
      // Alchemist's threshold: 17.1%, which is high for an epic and correct —
      // software margins are absurd and the corpus says so.
      {
        rarity: 'epic',
        min: 95,
        name: 'Overhead Girdle',
        icon: 'inv_belt_27',
        after: 'Onslaught Girdle',
      },
      {
        rarity: 'legendary',
        min: 100,
        name: 'Belt of Never-Ending Runway',
        icon: 'inv_belt_29',
        after: 'Belt of Never-Ending Agony',
      },
    ],
  },
  {
    key: 'legs',
    varyBy: 'armor',
    label: 'Legs',
    stat: 'Visitors',
    glyph: 'legplate',
    read: (i) => positive(i.visitors30d),
    format: count,
    items: [
      {
        rarity: 'common',
        min: 1,
        name: 'Patched Traffic Pants',
        icon: 'inv_pants_09',
        after: 'Patched Pants',
        variants: {
          cloth: {
            name: 'Patched Traffic Leggings',
            after: 'Patched Cloth Pants',
            icon: 'inv_pants_cloth_01',
          },
          leather: {
            name: 'Patched Traffic Britches',
            after: 'Patched Pants',
            icon: 'inv_pants_leather_01',
          },
          mail: {
            name: 'Patched Traffic Legguards',
            after: 'Patched Mail Pants',
            icon: 'inv_pants_mail_01',
          },
          plate: {
            name: 'Patched Traffic Legplates',
            after: 'Patched Plate Pants',
            icon: 'inv_pants_plate_01',
          },
        },
      },
      {
        rarity: 'uncommon',
        min: 400,
        name: 'Leggings of the First Thousand',
        icon: 'inv_pants_11',
        after: 'Leggings of the Fang',
        variants: {
          cloth: {
            name: 'Leggings of the First Thousand',
            after: 'Leggings of the Fang',
            icon: 'inv_pants_cloth_05',
          },
          leather: {
            name: 'Britches of the First Thousand',
            after: 'Britches of the Fang',
            icon: 'inv_pants_leather_05',
          },
          mail: {
            name: 'Legguards of the First Thousand',
            after: 'Legguards of the Fang',
            icon: 'inv_pants_mail_05',
          },
          plate: {
            name: 'Legplates of the First Thousand',
            after: 'Legplates of the Fang',
            icon: 'inv_pants_plate_05',
          },
        },
      },
      {
        rarity: 'rare',
        min: 3_300,
        name: 'Trafficstalker Legguards',
        icon: 'inv_pants_03',
        after: 'Cryptstalker Legguards',
        variants: {
          cloth: {
            name: 'Trafficweave Leggings',
            after: 'Cryptstalker Leggings',
            icon: 'inv_pants_cloth_09',
          },
          leather: {
            name: 'Trafficstalker Britches',
            after: 'Cryptstalker Britches',
            icon: 'inv_pants_leather_09',
          },
          mail: {
            name: 'Trafficstalker Legguards',
            after: 'Cryptstalker Legguards',
            icon: 'inv_pants_mail_09',
          },
          plate: {
            name: 'Trafficstalker Legplates',
            after: 'Cryptstalker Legplates',
            icon: 'inv_pants_plate_09',
          },
        },
      },
      // Server Full's threshold: 2.1%.
      {
        rarity: 'epic',
        min: 22_000,
        name: 'Legplates of the Front Page',
        icon: 'inv_pants_04',
        after: 'Legplates of Might',
        variants: {
          cloth: {
            name: 'Leggings of the Front Page',
            after: 'Leggings of Might',
            icon: 'inv_pants_cloth_14',
          },
          leather: {
            name: 'Britches of the Front Page',
            after: 'Britches of Might',
            icon: 'inv_pants_leather_11',
          },
          mail: {
            name: 'Legguards of the Front Page',
            after: 'Legguards of Might',
            icon: 'inv_pants_mail_11',
          },
          plate: {
            name: 'Legplates of the Front Page',
            after: 'Legplates of Might',
            icon: 'inv_pants_plate_11',
          },
        },
      },
      {
        rarity: 'legendary',
        min: 100_000,
        name: 'Legwraps of the Viral Ascendant',
        icon: 'inv_pants_08',
        after: 'Leggings of Transcendence',
        variants: {
          cloth: {
            name: 'Legwraps of the Viral Ascendant',
            after: 'Leggings of Transcendence',
            icon: 'inv_pants_cloth_21',
          },
          leather: {
            name: 'Legguards of the Viral Ascendant',
            after: 'Legguards of Transcendence',
            icon: 'inv_pants_leather_14',
          },
          mail: {
            name: 'Legstrides of the Viral Ascendant',
            after: 'Legstrides of Transcendence',
            icon: 'inv_pants_mail_14',
          },
          plate: {
            name: 'Legplates of the Viral Ascendant',
            after: 'Legplates of Transcendence',
            icon: 'inv_pants_plate_14',
          },
        },
      },
    ],
  },
  {
    key: 'feet',
    varyBy: 'armor',
    label: 'Feet',
    stat: 'Growth 30d',
    glyph: 'sabaton',
    // No MRR is no growth rate, rather than 0%: the weighted average of nothing
    // is not a flat month, it is silence.
    read: (i) => (i.mrrUsd > 0 ? i.growthMrr30d : null),
    format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
    items: [
      {
        rarity: 'common',
        min: 0,
        name: 'Worn Bootstraps',
        icon: 'inv_boots_05',
        after: 'Worn Leather Boots',
        variants: {
          cloth: {
            name: 'Worn Bootstrap Slippers',
            after: 'Worn Cloth Slippers',
            icon: 'inv_boots_cloth_01',
          },
          leather: { name: 'Worn Bootstraps', after: 'Worn Leather Boots', icon: 'inv_boots_05' },
          mail: {
            name: 'Worn Bootstrap Greaves',
            after: 'Worn Mail Boots',
            icon: 'inv_boots_chain_01',
          },
          plate: {
            name: 'Worn Bootstrap Sabatons',
            after: 'Worn Plate Boots',
            icon: 'inv_boots_plate_01',
          },
        },
      },
      {
        rarity: 'uncommon',
        min: 5,
        name: 'Windshear Runners',
        icon: 'inv_boots_08',
        after: 'Windshear Boots',
        variants: {
          cloth: {
            name: 'Windshear Slippers',
            after: 'Windshear Slippers',
            icon: 'inv_boots_cloth_03',
          },
          leather: { name: 'Windshear Runners', after: 'Windshear Boots', icon: 'inv_boots_08' },
          mail: {
            name: 'Windshear Striders',
            after: 'Windshear Striders',
            icon: 'inv_boots_chain_03',
          },
          plate: {
            name: 'Windshear Warboots',
            after: 'Windshear Warboots',
            icon: 'inv_boots_plate_03',
          },
        },
      },
      // Ascension's threshold: 8.2%.
      {
        rarity: 'rare',
        min: 20,
        name: 'Boots of Compounding',
        icon: 'inv_boots_09',
        after: 'Boots of Avoidance',
        variants: {
          cloth: {
            name: 'Slippers of Compounding',
            after: 'Slippers of Avoidance',
            icon: 'inv_boots_cloth_05',
          },
          leather: {
            name: 'Boots of Compounding',
            after: 'Boots of Avoidance',
            icon: 'inv_boots_09',
          },
          mail: {
            name: 'Striders of Compounding',
            after: 'Striders of Avoidance',
            icon: 'inv_boots_chain_05',
          },
          plate: {
            name: 'Sabatons of Compounding',
            after: 'Sabatons of Avoidance',
            icon: 'inv_boots_plate_04',
          },
        },
      },
      {
        rarity: 'epic',
        min: 100,
        name: 'Boots of the Hockey Stick',
        icon: 'inv_boots_02',
        after: 'Boots of the Shadow Flame',
        variants: {
          cloth: {
            name: 'Slippers of the Hockey Stick',
            after: 'Boots of the Shadow Flame',
            icon: 'inv_boots_cloth_07',
          },
          leather: {
            name: 'Boots of the Hockey Stick',
            after: 'Boots of the Shadow Flame',
            icon: 'inv_boots_02',
          },
          mail: {
            name: 'Striders of the Hockey Stick',
            after: 'Boots of the Shadow Flame',
            icon: 'inv_boots_chain_06',
          },
          plate: {
            name: 'Sabatons of the Hockey Stick',
            after: 'Boots of the Shadow Flame',
            icon: 'inv_boots_plate_06',
          },
        },
      },
      // Bloodlust's: 2.9% doubled their MRR in thirty days.
      {
        rarity: 'legendary',
        min: 260,
        name: 'Sabatons of the Doubling',
        icon: 'inv_boots_03',
        after: 'Sabatons of Might',
        variants: {
          cloth: {
            name: 'Footwraps of the Doubling',
            after: 'Footwraps of Might',
            icon: 'inv_boots_cloth_09',
          },
          leather: {
            name: 'Treads of the Doubling',
            after: 'Treads of Might',
            icon: 'inv_boots_03',
          },
          mail: {
            name: 'Greaves of the Doubling',
            after: 'Greaves of Might',
            icon: 'inv_boots_chain_08',
          },
          plate: {
            name: 'Sabatons of the Doubling',
            after: 'Sabatons of Might',
            icon: 'inv_boots_03',
          },
        },
      },
    ],
  },
  {
    key: 'ring1',
    label: 'Ring 1',
    stat: 'Shipping for',
    glyph: 'band',
    read: (i) => yearsSince(i.foundedFirst),
    format: (v) => `${v.toFixed(1)}y`,
    items: [
      {
        rarity: 'common',
        min: 0,
        name: 'Ring of the First Commit',
        icon: 'inv_jewelry_ring_03',
        after: 'Ring of Precision',
      },
      {
        rarity: 'uncommon',
        min: 1,
        name: 'Band of the First Year',
        icon: 'inv_jewelry_ring_15',
        after: 'Band of the Hierophant',
      },
      // Veteran's threshold: 17.5%.
      {
        rarity: 'rare',
        min: 2,
        name: 'Signet Ring of the Bronze Cohort',
        icon: 'inv_jewelry_ring_25',
        after: 'Signet Ring of the Bronze Dragonflight',
      },
      // Old Guard's: 5.1%.
      {
        rarity: 'epic',
        min: 5,
        name: "Master Bootstrapper's Ring",
        icon: 'inv_jewelry_ring_35',
        after: "Master Dragonslayer's Ring",
      },
      // Classic's: 0.9% have been at it a decade.
      {
        rarity: 'legendary',
        min: 10,
        name: 'Band of Recurring Eternity',
        icon: 'inv_jewelry_ring_43',
        after: 'Band of Accuria',
      },
    ],
  },
  {
    key: 'ring2',
    label: 'Ring 2',
    stat: 'Cofounders',
    glyph: 'band',
    // Zero is a real answer here and gets a real item, not an empty slot: 98.7%
    // of the corpus builds alone, and an armory that renders the normal case as
    // a hole would be telling almost everyone they are missing something.
    read: (i) => i.cofounders.length,
    format: count,
    items: [
      {
        rarity: 'common',
        min: 0,
        name: "Plain Founder's Band",
        icon: 'inv_jewelry_ring_01',
        after: 'Plain Iron Band',
      },
      // Guilded's threshold: 1.3%. Rare-and-up out of the gate, because having
      // anyone at all is the rarest fact on this sheet.
      {
        rarity: 'uncommon',
        min: 1,
        name: 'Ring of Binding Equity',
        icon: 'inv_jewelry_ring_12',
        after: 'Ring of Binding',
      },
      {
        rarity: 'rare',
        min: 2,
        name: 'Circle of Applied Founders',
        icon: 'inv_jewelry_ring_21',
        after: 'Circle of Applied Force',
      },
      {
        rarity: 'epic',
        min: 3,
        name: 'Seal of the Cap Table',
        icon: 'inv_jewelry_ring_30',
        after: 'Seal of the Dawn',
      },
      {
        rarity: 'legendary',
        min: 5,
        name: 'Band of the Founding Council',
        icon: 'inv_jewelry_ring_40',
        after: 'Band of Servitude',
      },
    ],
  },
  {
    key: 'trinket1',
    label: 'Trinket 1',
    stat: 'Categories',
    glyph: 'talisman',
    read: (i) => positive(i.categories.length),
    format: count,
    items: [
      {
        rarity: 'common',
        min: 1,
        name: 'Roadmap on a Stick',
        icon: 'inv_misc_food_54',
        after: 'Carrot on a Stick',
      },
      // Dual Spec's threshold: 3.9% build in two different markets.
      {
        rarity: 'uncommon',
        min: 2,
        name: 'Hand of Just Ship It',
        icon: 'inv_misc_bone_10',
        after: 'Hand of Justice',
      },
      {
        rarity: 'rare',
        min: 3,
        name: 'Briarwood Backlog',
        icon: 'inv_wand_01',
        after: 'Briarwood Reed',
      },
      {
        rarity: 'epic',
        min: 4,
        name: 'Insignia of the Second Market',
        icon: 'inv_misc_note_01',
        after: 'Insignia of the Horde',
      },
      {
        rarity: 'legendary',
        min: 5,
        name: 'Eye of the Portfolio',
        icon: 'inv_misc_eye_01',
        after: 'Eye of the Beast',
      },
    ],
  },
  {
    key: 'trinket2',
    label: 'Trinket 2',
    stat: 'Channels',
    glyph: 'talisman',
    // 22% coverage, the thinnest field on the sheet. Most founders wear nothing
    // here and that is the honest render, not a bug to paper over.
    read: (i) => positive(i.channels.length),
    format: count,
    items: [
      {
        rarity: 'common',
        min: 1,
        name: 'Flask of Cold Outreach',
        icon: 'inv_potion_62',
        after: 'Flask of the Titans',
      },
      {
        rarity: 'uncommon',
        min: 2,
        name: 'Drip Campaign Talisman',
        icon: 'inv_misc_monsterfang_01',
        after: 'Drake Fang Talisman',
      },
      {
        rarity: 'rare',
        min: 4,
        name: "Growth Loop's Breadth",
        icon: 'inv_misc_stonetablet_05',
        after: "Blackhand's Breadth",
      },
      {
        rarity: 'epic',
        min: 6,
        name: 'Diamond Distribution Flask',
        icon: 'inv_potion_27',
        after: 'Diamond Flask',
      },
      {
        rarity: 'legendary',
        min: 10,
        name: 'Talisman of the Omnichannel',
        icon: 'inv_misc_gem_variety_01',
        after: 'Talisman of Binding Shard',
      },
    ],
  },
  // --- Weapons -------------------------------------------------------------
  {
    key: 'mainHand',
    varyBy: 'weapon',
    label: 'Main Hand',
    stat: 'Monthly revenue',
    glyph: 'blade',
    read: (i) => positive(i.mrrUsd),
    format: usd,
    items: [
      {
        rarity: 'common',
        min: 1,
        name: 'Worn Invoice Blade',
        icon: 'inv_sword_04',
        after: 'Worn Shortsword',
        variants: {
          sword: { name: 'Worn Invoice Blade', after: 'Worn Shortsword', icon: 'inv_sword_04' },
          axe: { name: 'Notched Invoice Axe', after: 'Notched Axe', icon: 'inv_axe_02' },
          hammer: { name: 'Dented Standup Hammer', after: 'Dented Hammer', icon: 'inv_hammer_16' },
          mace: { name: 'Worn Sprint Mace', after: 'Worn Mace', icon: 'inv_mace_01' },
          staff: { name: 'Gnarled Bootstrap Staff', after: 'Gnarled Staff', icon: 'inv_staff_08' },
          dagger: {
            name: 'Bent Beta Shiv',
            after: 'Bent Dagger',
            icon: 'inv_weapon_shortblade_05',
          },
          fist: { name: 'Worn Sparring Wraps', after: 'Worn Claw', icon: 'inv_weapon_hand_01' },
        },
      },
      {
        rarity: 'uncommon',
        min: 100,
        name: 'Kroll Blade',
        icon: 'inv_sword_35',
        after: 'Krol Blade',
        variants: {
          sword: { name: 'Kroll Blade', after: 'Krol Blade', icon: 'inv_sword_35' },
          axe: { name: 'Deprecated Hatchet', after: 'Deadly Hatchet', icon: 'inv_axe_04' },
          hammer: { name: 'Vesting Fist', after: "Verigan's Fist", icon: 'inv_hammer_08' },
          mace: { name: 'Mass of Metrics', after: 'Mass of McGowan', icon: 'inv_mace_08' },
          staff: { name: 'Staff of Standups', after: 'Staff of Jordan', icon: 'inv_staff_13' },
          dagger: { name: 'Shadowbank', after: 'Shadowfang', icon: 'inv_weapon_shortblade_11' },
          fist: {
            name: 'Cold Outreach Knuckles',
            after: 'Cold Forged Knuckles',
            icon: 'inv_weapon_hand_03',
          },
        },
      },
      // Ramen Profitable's threshold: 16.5%.
      {
        rarity: 'rare',
        min: 1_000,
        name: "Quel'Server",
        icon: 'inv_sword_38',
        after: "Quel'Serrar",
        variants: {
          sword: { name: "Quel'Server", after: "Quel'Serrar", icon: 'inv_sword_38' },
          axe: { name: 'Ravager of Retainers', after: 'Ravager', icon: 'inv_axe_14' },
          hammer: {
            name: 'Hammer of the Northern Launch',
            after: 'Hammer of the Northern Wind',
            icon: 'inv_hammer_05',
          },
          mace: { name: 'Sceptre of Standups', after: 'Sceptre of Smiting', icon: 'inv_mace_10' },
          staff: {
            name: 'Serpent Staff of Shipping',
            after: 'Serpentine Staff',
            icon: 'inv_staff_20',
          },
          dagger: {
            name: 'Cohort Tooth',
            after: 'Core Hound Tooth',
            icon: 'inv_weapon_shortblade_15',
          },
          fist: {
            name: 'Claw of the Cohort',
            after: 'Claw of the Black Drake',
            icon: 'inv_weapon_hand_07',
          },
        },
      },
      /*
       * Raid Boss Slayer's threshold: 9.3%.
       *
       * "Arcanite Refunder" was the first draft and read better as a joke. It is
       * out under the never-demeaning rule: a refund is a bad day, and this is
       * the item somebody screenshots on their best month. "Revenuer" keeps the
       * -er cadence and the two opening syllables, which is all the recognition
       * the derivation needs.
       */
      {
        rarity: 'epic',
        min: 10_000,
        name: 'Arcanite Revenuer',
        icon: 'inv_axe_09',
        after: 'Arcanite Reaper',
        variants: {
          sword: { name: 'Brutality Backlog', after: 'Brutality Blade', icon: 'inv_sword_43' },
          axe: { name: 'Arcanite Revenuer', after: 'Arcanite Reaper', icon: 'inv_axe_09' },
          hammer: {
            name: 'The Unstoppable Roadmap',
            after: 'The Unstoppable Force',
            icon: 'inv_hammer_17',
          },
          mace: { name: 'Aurastone Dashboard', after: 'Aurastone Hammer', icon: 'inv_mace_18' },
          staff: {
            name: 'Staff of Distribution',
            after: 'Staff of Dominance',
            icon: 'inv_staff_30',
          },
          dagger: {
            name: "Alcor's Runrate",
            after: "Alcor's Sunrazor",
            icon: 'inv_weapon_shortblade_25',
          },
          fist: {
            name: 'Fists of the Founder',
            after: 'Fists of the Unrelenting',
            icon: 'inv_weapon_hand_10',
          },
        },
      },
      // Mythic's: 1.4%. One sound moves and the whole name lands.
      {
        rarity: 'legendary',
        min: 100_000,
        name: 'Cashbringer',
        icon: 'inv_sword_62',
        after: 'Ashbringer',
        variants: {
          sword: { name: 'Cashbringer', after: 'Ashbringer', icon: 'inv_sword_62' },
          axe: { name: 'Growthhowl', after: 'Gorehowl', icon: 'inv_axe_21' },
          hammer: {
            name: 'Sulfuras, Hand of the Roadmap',
            after: 'Sulfuras, Hand of Ragnaros',
            icon: 'inv_hammer_20',
          },
          mace: {
            name: 'Hammer of Ten Thousand Tickets',
            after: 'Hammer of Ten Storms',
            icon: 'inv_mace_25',
          },
          staff: {
            name: 'Atiesh, Greatstaff of the Guild',
            after: 'Atiesh, Greatstaff of the Guardian',
            icon: 'inv_staff_31',
          },
          dagger: { name: 'Cashfall', after: 'Kingsfall', icon: 'inv_weapon_shortblade_30' },
          fist: {
            name: 'Shipfury, Blessed Fists of the Bootstrapper',
            after: 'Thunderfury, Blessed Blade of the Windseeker',
            icon: 'inv_weapon_hand_12',
          },
        },
      },
    ],
  },
  {
    key: 'offHand',
    varyBy: 'offhand',
    label: 'Off Hand',
    stat: 'Lifetime revenue',
    glyph: 'buckler',
    read: (i) => positive(i.revenueTotalUsd),
    format: usd,
    items: [
      // First Blood's threshold: 76.1%, the commonest fact in the corpus.
      {
        rarity: 'common',
        min: 1,
        name: 'Battered Ledger Buckler',
        icon: 'inv_shield_04',
        after: 'Battered Buckler',
        variants: {
          focus: { name: 'Battered Ledger', after: 'Battered Tome', icon: 'inv_misc_book_09' },
          blade: {
            name: 'Battered Ledger Shiv',
            after: 'Battered Dagger',
            icon: 'inv_weapon_shortblade_04',
          },
        },
      },
      // The Thousand's: 41.3%.
      {
        rarity: 'uncommon',
        min: 1_000,
        name: 'Drillborer Dashboard',
        icon: 'inv_shield_09',
        after: 'Drillborer Disk',
        variants: {
          focus: {
            name: 'Codex of the Dashboard',
            after: 'Codex of Wisdom',
            icon: 'inv_misc_book_07',
          },
          blade: {
            name: 'Drillborer Shiv',
            after: 'Drillborer Disk',
            icon: 'inv_weapon_shortblade_08',
          },
        },
      },
      // Ten Thousand's: 24.3%.
      {
        rarity: 'rare',
        min: 10_000,
        name: 'Aegis of Runway',
        icon: 'inv_shield_21',
        after: 'Aegis of Preservation',
        variants: {
          focus: {
            name: 'Tome of Runway',
            after: 'Tome of Preservation',
            icon: 'inv_misc_book_11',
          },
          blade: {
            name: 'Edge of Runway',
            after: 'Edge of Preservation',
            icon: 'inv_weapon_shortblade_12',
          },
        },
      },
      // Exalted's: 14.1%.
      {
        rarity: 'epic',
        min: 100_000,
        name: 'Lei of the Lifetime',
        icon: 'inv_shield_18',
        after: 'Lei of the Lifegiver',
        variants: {
          focus: {
            name: 'Grimoire of the Lifetime',
            after: 'Grimoire of the Lifegiver',
            icon: 'inv_misc_book_03',
          },
          blade: {
            name: 'Fang of the Lifetime',
            after: 'Fang of the Lifegiver',
            icon: 'inv_weapon_shortblade_18',
          },
        },
      },
      // The Million's: 4.7%.
      {
        rarity: 'legendary',
        min: 1_000_000,
        name: "Perdition's Ledger",
        icon: 'inv_shield_30',
        after: "Perdition's Blade",
        variants: {
          focus: {
            name: "Perdition's Codex",
            after: "Perdition's Blade",
            icon: 'inv_misc_book_05',
          },
          blade: {
            name: "Perdition's Shiv",
            after: "Perdition's Blade",
            icon: 'inv_weapon_shortblade_22',
          },
        },
      },
    ],
  },
  {
    key: 'ranged',
    label: 'Ranged',
    stat: 'Impressions',
    glyph: 'longbow',
    read: (i) => positive(i.googleImpressions30d),
    format: count,
    items: [
      {
        rarity: 'common',
        min: 1,
        name: 'Crude Sitemap Bow',
        icon: 'inv_weapon_bow_02',
        after: 'Crude Bow',
      },
      {
        rarity: 'uncommon',
        min: 1_200,
        name: 'Bow of Searing Queries',
        icon: 'inv_weapon_bow_08',
        after: 'Bow of Searing Arrows',
      },
      {
        rarity: 'rare',
        min: 12_000,
        name: "Seeker's Mark",
        icon: 'inv_weapon_crossbow_02',
        after: "Striker's Mark",
      },
      // Summoned's threshold: 0.3%, the rarest achievement that is not a title.
      {
        rarity: 'epic',
        min: 40_000,
        name: "Ashjre'thul, Crossbow of Sitemaps",
        icon: 'inv_weapon_crossbow_10',
        after: "Ashjre'thul, Crossbow of Smiting",
      },
      {
        rarity: 'legendary',
        min: 250_000,
        name: "Rank'delar, Longbow of the Ancient Crawlers",
        icon: 'inv_weapon_bow_13',
        after: "Rhok'delar, Longbow of the Ancient Keepers",
      },
    ],
  },
]

export const SLOTS_BY_KEY = new Map(SLOTS.map((s) => [s.key, s]))
