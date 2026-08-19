/** One of a founder's products, already converted to dollars. Cents stay at the edge. */
export interface ProductInput {
  slug: string
  name: string | null
  iconUrl: string | null
  /** revenue.total, lifetime, in dollars. */
  revenueTotalUsd: number
  /** revenue.mrr, in dollars. */
  mrrUsd: number
  /** revenue.last30Days, in dollars. What actually came in this month. */
  last30dUsd: number
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
  /** raw.xFollowerCount. Feeds the Neck slot, and through it the item level. */
  followers: number | null
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
  /**
   * Revenue over the last thirty days, summed across the products.
   *
   * Reported on 52% of founders — better coverage than anything else that was
   * not already a slot, which is why it became one.
   */
  last30dUsd: number
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
  /**
   * Best xFollowerCount across the products.
   *
   * This deliberately used to live OUTSIDE the aggregate, on the grounds that
   * it comes from X rather than TrustMRR and fed no level, class or rank. That
   * reasoning expired the moment item level became the average of the worn
   * gear: the Neck slot is followers, and a slot that counts toward the score
   * cannot be read from a field the scoring object does not have — compute and
   * the sheet would average different numbers of slots and disagree about the
   * same founder.
   */
  followers: number | null
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
  /**
   * Blizzard icon slug. Checked in bulk by `pnpm verify-icons`, same as items.
   *
   * Chosen for meaning wherever the reference has a picture for the same idea —
   * Exalted is a reputation rank and wears the reputation icon, Bloodlust is a
   * real spell and wears its own. That is the whole reason these are worth
   * borrowing: a player recognises the badge before reading its name.
   */
  icon: string
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
   *
   * Rarity is what a badge is WORTH, and the share is only the best evidence
   * for it, not the definition. Two sit deliberately above their band:
   * `realm_first` because there is exactly one per realm and no amount of work
   * gets you a second, and `renowned` because a domain rating of 70 is years of
   * somebody else's links rather than a number you can decide to have. Both are
   * at 1.6%, which is epic by the arithmetic and legendary by the ask.
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

/* ---------------------------------------------------------------------------
 * Quests — what to do next
 *
 * A quest is not new data. Every ingredient was already being computed and then
 * printed in a different panel: the next rung of a worn item, the first rung of
 * an empty one, an achievement's distance to its target, the XP left in a
 * level. The four panels never spoke to each other, so a founder could read all
 * of them and still not know which single thing to go and do.
 *
 * So this is a ranking problem wearing a content problem's clothes. Generating
 * seventy candidates is trivial; choosing three is the whole feature.
 * ------------------------------------------------------------------------- */

export type QuestKind = 'equip' | 'upgrade' | 'achievement' | 'level' | 'product' | 'rank' | 'set'

/**
 * The reference's own difficulty scale, five bands, grey through red.
 *
 * These replaced close/fair/hard/steep, which was a vocabulary invented for a
 * scale that already has one millions of people read fluently — the same
 * argument the class colours are built on. A player knows a grey quest costs
 * nothing and a red one is a long way off without being told.
 *
 * The axis is not identical to the game's. There, colour is your level against
 * the quest's; here it is how far the number has to travel, with a slot you can
 * fill by typing counting as trivial. Easy to hard survives the translation,
 * which is the part anybody actually reads.
 */
export type QuestDifficulty = 'trivial' | 'easy' | 'standard' | 'hard' | 'severe'

export interface Quest {
  /** Stable across recomputes: `equip:ranged`, `achievement:ding_sixty`. */
  code: string
  kind: QuestKind
  /**
   * The line a founder reads.
   *
   * Never phrased as an accusation, and that is a data constraint rather than a
   * matter of taste. TrustMRR's API sends 0 rather than null for an unfilled
   * field — 96% of listings report zero customers, including ones with real
   * MRR — so "you have not reported your customers" is a guess that is wrong
   * about half the time. An empty slot is stated as an empty slot, which is
   * true whether the zero is real or a default, and it is what a founder can
   * act on either way.
   */
  title: string
  /** What finishes it, in the units the slot or badge already uses. */
  requirement: string
  /** What changes on the sheet when it does — the name alone, no quality in it. */
  reward: string
  /**
   * The reward's picture and quality.
   *
   * The log was the one place on the site that talked about gear without
   * showing any, which made it read as a form rather than as part of the
   * armory. The colour also carries what "(common)" used to say in parentheses,
   * so the name gets to be just a name.
   */
  rewardIcon: string | null
  rewardRarity: RarityName | null
  /**
   * What to actually go and do, in the imperative.
   *
   * The condition alone was not a quest. "Followers of 1" states when the slot
   * fills and leaves a founder with no idea where the number is entered, and
   * the first person to read it said so. Every stat on this site arrives
   * through a TrustMRR listing, so the instruction is the same whether the zero
   * behind an empty slot is real or a default — which is what makes it sayable
   * at all, given we cannot tell those two apart.
   */
  action: string
  /** Where the action happens. Null when there is nowhere to send anybody. */
  href: string | null
  /**
   * How close, when the distance is knowable.
   *
   * Null for a slot whose stat has no usable value: there is no "current" to
   * measure from, and inventing 0 would draw an empty bar that reads as failure
   * rather than as silence.
   */
  progress: { current: number; target: number; ratio: number } | null
  /**
   * Where this sits in its ladder, when it belongs to one.
   *
   * A slot's five rungs are a chain and only ever one link of it was shown, so
   * a founder saw an instruction with no arc behind it. "Step 2 of 5" is the
   * difference between a chore and a progression.
   */
  chain: { step: number; of: number } | null
  difficulty: QuestDifficulty
  /** Sort key, descending. Set by the ranker, never by a generator. */
  weight: number
}

/**
 * Something that finished, read out of the snapshot history.
 *
 * Derived, not stored — the same argument as everything else here. A threshold
 * crossed between two crawls is a fact already sitting in the table, and a
 * `completed_quests` row would be a cache of it that could disagree.
 *
 * This is the only part of the sheet that is different on a second visit, which
 * is the whole reason it exists: everything else is a photograph.
 */
export interface QuestDone {
  code: string
  line: string
  /** ISO day the crossing was first visible. */
  on: string
}

/**
 * What the quest log reads.
 *
 * The doll and the progress input arrive already built rather than being
 * re-derived, for the same reason `equipmentInput` takes the class from its
 * caller: two places computing the same thing is two places to disagree, and
 * the sheet has to agree with itself.
 */
export interface QuestInput {
  doll: EquippedSlot[]
  /**
   * The founder's products, each scored on the Main Hand ladder exactly as the
   * sheet already scores them. 650 founders have more than one and none of them
   * had a quest about any of it.
   */
  products: { slug: string; name: string; mrrUsd: number }[]
  /**
   * Standing, when the caller has it. Not pure — it needs the whole ladder —
   * so it arrives the same way the class does.
   *
   * `aboveRevenueUsd` rather than a rank alone because a rank quest has to name
   * a number, and the ladder is sorted on lifetime revenue.
   */
  rank: { rank: number; aboveRevenueUsd: number | null } | null
  /** Lifetime revenue, for measuring the climb to the rank above. */
  revenueTotalUsd: number
  /**
   * The founder's TrustMRR page, which is where every number on the sheet is
   * entered. Passed in rather than built here: the engine knows nothing about
   * hosts, exactly as it knows nothing about which CDN serves the icons.
   */
  listingUrl: string | null
  /** Codes already earned, so a finished badge is not offered as a quest. */
  earned: string[]
  progress: AchievementProgressInput
  level: number
  xp: number
}

export interface Rarity {
  name: string
  hex: string
}

/* ---------------------------------------------------------------------------
 * Equipment — the paper doll
 *
 * A product used to be a piece of gear, which meant a founder with one product
 * had one item and an armory that was 94% empty. The slots are the STATS now:
 * every founder has an MRR, a domain rating, a customer count, so every founder
 * has something in most slots and the sheet reads as a character rather than a
 * list of one.
 * ------------------------------------------------------------------------- */

/**
 * The seventeen scored slots, in the reference's own order.
 *
 * Shirt and Tabard are deliberately absent: they would carry realm and faction,
 * which have no quality — you do not out-earn your way to a better country. The
 * `Standing` panel already renders both, and a slot with no rarity in a grid
 * whose whole language is rarity would read as broken.
 */
export type SlotKey =
  | 'head'
  | 'neck'
  | 'shoulders'
  | 'back'
  | 'chest'
  | 'wrist'
  | 'hands'
  | 'waist'
  | 'legs'
  | 'feet'
  | 'ring1'
  | 'ring2'
  | 'trinket1'
  | 'trinket2'
  | 'mainHand'
  | 'offHand'
  | 'ranged'

/**
 * The drawn fallback, one per shape of thing rather than per slot: both rings
 * share a band and both trinkets share a talisman, as the reference does.
 *
 * No longer what the sheet shows. Items carry a real Blizzard icon now (see
 * ItemDef.icon) and these fifteen sit behind them, for the two cases a remote
 * JPEG cannot serve: an image that fails to load, and the OG card, where Satori
 * would otherwise fetch seventeen icons over the network to render one PNG.
 *
 * They inherit their quality colour through `currentColor` like every other
 * icon in the set, which the JPEGs cannot do — a fallback that is legible but
 * plainly not the real thing is the right shape for a fallback.
 */
export type EquipmentGlyph =
  | 'helm'
  | 'pendant'
  | 'pauldron'
  | 'cloak'
  | 'cuirass'
  | 'bracer'
  | 'gauntlet'
  | 'girdle'
  | 'legplate'
  | 'sabaton'
  | 'band'
  | 'talisman'
  | 'blade'
  | 'buckler'
  | 'longbow'

/**
 * What a class wears and what it swings.
 *
 * The reference's oldest rule, and the one a player notices being broken before
 * any other: a Mage does not wear plate, and a Priest does not carry an axe. An
 * armory that hands every class the same breastplate is a spreadsheet wearing a
 * costume — the gear is supposed to say what you ARE, and it cannot do that if
 * it says the same thing to everyone.
 */
export type ArmorType = 'cloth' | 'leather' | 'mail' | 'plate'

export type WeaponFamily = 'sword' | 'axe' | 'hammer' | 'dagger' | 'staff' | 'mace' | 'fist'

/**
 * What a class holds in its off hand — its own axis, not armour's.
 *
 * The off hand used to key off ArmorType on the reasoning that heavy armour
 * means a shield. It does not, and the counterexample is the loudest one
 * available: Hunters wear mail and CANNOT equip a shield in any version of the
 * game. Nor can Evokers, who also wear mail. Shield proficiency simply does not
 * follow armour class — Shamans wear mail and can, Rogues wear leather and
 * cannot, Priests wear cloth and can.
 *
 *   shield — Warrior, Paladin, Shaman
 *   blade  — the dual-wielders: Rogue, Monk, Hunter
 *   focus  — a tome or orb, for the casters who hold neither
 */
export type OffHandKind = 'shield' | 'blade' | 'focus'

/** A per-class swap of the three things that carry the joke. */
export interface ItemVariant {
  name: string
  after: string
  icon: string
}

export interface ItemDef {
  rarity: RarityName
  /** The name the sheet shows. */
  name: string
  /**
   * Blizzard's icon slug for the item this derives from, e.g. `inv_axe_09`.
   *
   * Resolved to a URL by lib/wow-icon.ts and verified in bulk by
   * `pnpm verify-icons`, which HEADs every one of them — a slug that has been
   * guessed rather than checked renders as a hole in the grid, and there are
   * eighty-five chances to guess wrong.
   */
  icon: string
  /**
   * The Classic item it derives from. Never rendered anywhere.
   *
   * It earns its place as the thing a contributor checks a rename against: the
   * whole gag only works if the original is recognisable in half a second, and
   * without this field beside the name there is no way to review whether a
   * proposed item still is one.
   */
  after: string
  /** Lowest stat value that wears this item. */
  min: number
  /**
   * What this item becomes for a class that wears something else.
   *
   * Keyed by ArmorType on an armour slot and by WeaponFamily on the main hand;
   * the fields above are the fallback when a key is absent, which is how a slot
   * that genuinely does not vary — a ring, a trinket, a cloak — stays one entry
   * instead of five identical ones.
   *
   * The threshold never varies, only the picture and the noun. A Mage and a
   * Warrior on the same MRR hold the same rung of the same ladder; what differs
   * is that one of them is holding a staff.
   */
  variants?: Partial<Record<ArmorType | WeaponFamily | OffHandKind, ItemVariant>>
}

/**
 * Why a slot is empty. The distinction is the same one the rest of the engine
 * makes everywhere — see `ilvlFrom` and the retention guards — and it is the
 * difference between "we were never told" and "not yet".
 */
export type EmptyReason = 'unreported' | 'unearned'

export interface SlotDef {
  key: SlotKey
  /**
   * Share of the corpus with a usable value for this stat, 0–1.
   *
   * Measured, and the quest log's only substitute for a distance. An empty slot
   * has no "current" to measure from, so every equip quest would otherwise
   * score identically and each thin sheet would be handed the same three in
   * alphabetical order. This says instead how attainable the slot is: a stat
   * four founders in five manage to have on record is an easier win than one
   * only two in ten do, and the easy wins are what the reporting phase is for.
   *
   * Remeasure by counting `unreported` empties per slot across the corpus; a
   * stale figure only reorders advice slightly, so it is not worth a job.
   */
  reportedShare: number
  /**
   * Whether effort can move this stat at all.
   *
   * False for the two that only time or a life decision changes: years shipping
   * and cofounders. Both make perfectly good EQUIP quests — declaring a
   * founding date is data entry like any other — and useless upgrade ones. "Grow
   * it past 5 years, then update TrustMRR" is not advice, it is a wait, and a
   * log that hands somebody a wait has spent its credibility on a line nobody
   * can act on.
   */
  movable: boolean
  /**
   * How a founder actually gets this number onto TrustMRR, in the imperative.
   *
   * Read off the real listing form rather than off the API payload, and the
   * difference mattered: the API exposes `revenue.mrr`, `customers` and
   * `activeSubscriptions`, so the first version of this told people to "set
   * your MRR on your listing" — and the form has no such box. Those arrive by
   * connecting a payment provider. Visitors arrive by connecting DataFast or
   * Google Analytics. Categories are called Markets. Domain rating is derived
   * from the website URL and typed in nowhere.
   *
   * An instruction that names a field nobody can find is worse than the vague
   * one it replaced, so these are the words on the form.
   */
  fill: string
  /**
   * Where the number comes from, which decides how much it is worth.
   *
   * Read off the listing form. `connected` means TrustMRR gets it from a linked
   * account or measures it itself — a payment provider, an analytics
   * integration, Search Console, the X handle — so nobody can type it. `declared`
   * means the founder wrote it in a box, and `counted` means it is a count of
   * listings.
   *
   * Worth stating out loud because six of the seventeen are declared, and three
   * of those are tag pickers with a cap: a legendary trinket is five market tags
   * ticked, and 12% of everybody reporting a profit margin types exactly 100.
   * The site claims every number on it is falsifiable. Half of them are audited
   * by an integration; the rest are somebody's word, and a reader is owed the
   * difference.
   */
  sourced: 'connected' | 'declared' | 'counted'
  /**
   * Which axis this slot's `variants` are keyed on, if any.
   *
   * Stated per slot rather than inferred from the key so that adding a slot
   * cannot silently get the wrong axis. There are three, and the third exists
   * because the off hand was briefly keyed on armour and handed every Hunter a
   * shield they cannot equip.
   */
  varyBy?: 'armor' | 'weapon' | 'offhand'
  /** 'Main Hand'. */
  label: string
  /** The stat this slot IS, in the words the sheet uses: 'Monthly revenue'. */
  stat: string
  glyph: EquipmentGlyph
  /**
   * Null when the corpus never answered, which is most of TrustMRR on most
   * fields. Returning 0 instead would dress a founder in grey for a blank.
   */
  read: (input: EquipmentInput) => number | null
  format: (value: number) => string
  /** Exactly five, ascending by `min`. */
  items: readonly ItemDef[]
}

export interface EquippedItem {
  name: string
  /**
   * This piece's own item level, 1–60.
   *
   * Where the stat sits on its own ladder, not where it sits against every
   * other founder: a legendary belt and a legendary blade are both near 60
   * because both are the top rung of their slot. The character's iLvl is the
   * mean of these, exactly as the game does it — see `ilvlFromDoll`.
   */
  itemLevel: number
  /**
   * The icon slug, not a URL.
   *
   * Building the address is lib/wow-icon.ts's job: the engine is pure and has
   * no business knowing which CDN is serving us this week, and a slug survives
   * the host changing while a baked URL does not.
   */
  icon: string
  rarity: Rarity
  /** The raw stat, and the same number written the way the slot writes it. */
  value: number
  valueLabel: string
  /**
   * The next item up, when there is one. This is the slot's answer to "what do
   * I do about it" — a paper doll that only reports is a table with pictures.
   */
  next: { name: string; icon: string; rarity: Rarity; min: number; minLabel: string } | null
}

export interface EquippedSlot {
  slot: SlotKey
  label: string
  stat: string
  glyph: EquipmentGlyph
  /** Null when nothing is worn; `empty` then says which kind of nothing. */
  item: EquippedItem | null
  empty: EmptyReason | null
}

/**
 * What the paper doll reads: the aggregate, plus the one thing that decides
 * which variant of each item gets worn.
 */
export interface EquipmentInput extends FounderAggregate {
  /**
   * Decides which variant of each item they wear. Not derived here: `classFrom`
   * owns that decision, compute writes it down, and the sheet reads the same
   * answer the ladder does — the doll must never disagree with the class printed
   * above it on the same page.
   */
  characterClass: CharacterClass
}

/** The engine's output. Pure function: no database access, no side effects. */
export interface CharacterSheet {
  handle: string
  xp: number
  level: number
  /** Null when the founder has no recurring revenue: the metric does not apply. */
  ilvl: number | null
  /**
   * How much of the doll is filled.
   *
   * Replaces `ilvlDelta`, which was `ilvl - level` and stopped meaning anything
   * the moment iLvl became the mean of the worn gear: the two numbers no longer
   * share a scale, and the reference never subtracts them either. Slots filled
   * is what a player actually reads off a paper doll, and unlike a delta it
   * points at something to go and do.
   */
  equipped: { worn: number; total: number }
  class: CharacterClass
  rarity: Rarity
  nProducts: number
  realm: string | null
  faction: Faction | null
  achievements: string[]
  /** Remaining XP and [0,1] progress toward the next level. */
  progress: { current: number; next: number | null; ratio: number }
}
