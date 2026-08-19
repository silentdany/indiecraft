import { levelBounds, rarityFor } from './character'
import { scoreOnSlot } from './equipment'
import { ACHIEVEMENTS, QUESTS, SLOTS_BY_KEY, STAT_ICONS } from './tuning'
import type { Quest, QuestDifficulty, QuestDone, QuestInput, QuestKind, RarityName } from './types'

/**
 * The quest log: what to do next, ranked.
 *
 * Pure, and deliberately so — same argument the paper doll makes. A quest is a
 * function of a sheet that has already been computed, so storing one would be
 * caching something cheaper to recompute than to invalidate, and a `quests`
 * table would go stale every time a threshold moved in tuning.ts.
 *
 * Nothing here is authored per quest. The generators walk SLOTS and
 * ACHIEVEMENTS, so seventeen slots and thirty-five badges produce their quests
 * on their own and a rebalance carries the log with it. That is the property
 * worth protecting: the expensive version of this feature is one where adding a
 * slot means writing two more paragraphs of copy.
 *
 * ---------------------------------------------------------------------------
 * What this cannot say.
 *
 * TrustMRR's API sends 0 rather than null for a field nobody filled in — 96% of
 * listings report zero customers, including listings with real MRR, which is
 * arithmetically impossible. So "you have not reported X" is a guess that is
 * wrong about half the time, and no quest is allowed to make it. Every line
 * below talks about the slot and the item in it, which is true whether the zero
 * is a real zero or a default, and is the same thing to go and do either way.
 * ---------------------------------------------------------------------------
 */

/**
 * How dressed the sheet is, 0–1.
 *
 * Worn slots over seventeen, which is the number already printed under the
 * portrait. Using the visible figure rather than a private one means a founder
 * can see the thing the log is reacting to.
 */
export function completion(input: Pick<QuestInput, 'doll'>): number {
  if (input.doll.length === 0) return 1
  return input.doll.filter((s) => s.item !== null).length / input.doll.length
}

/** Every quest a founder could take, best first. */
export function questsFor(input: QuestInput): Quest[] {
  const quests: Candidate[] = [
    ...equipQuests(input),
    ...upgradeQuests(input),
    ...achievementQuests(input),
    ...levelQuest(input),
    ...productQuests(input),
    ...rankQuest(input),
    ...realmQuest(input),
    ...setQuest(input),
  ]

  /*
   * A blank field is not a small amount of progress, it is a different kind of
   * work — thirty seconds against months — so the log pushes reporting while
   * ANY slot is blank, and switches only when none are left.
   *
   * It used to switch at a completion percentage, and that was wrong in a way
   * only a real sheet showed: at 82% equipped a founder was told to raise a
   * domain rating, which is a season of SEO, while a profit margin and a
   * marketing-channel list sat empty behind one form. The threshold was mine to
   * invent and it invented the bug; "until it is complete" was the ask.
   */
  const phase = quests.some((q) => q.kind === 'equip') ? 'reporting' : 'growing'
  const weights = QUESTS.weights[phase]

  return quests
    .map(({ attainability: _internal, ...q }) => ({
      ...q,
      chain: q.chain ?? null,
      difficulty: 'standard' as QuestDifficulty,
      weight: 0,
    }))
    .map((q, i) => ({
      ...q,
      difficulty: hardness(quests[i]!),
      weight: score(quests[i]!, weights[q.kind]),
    }))
    .sort((a, b) => b.weight - a.weight || a.code.localeCompare(b.code))
}

/**
 * Kind first, distance second.
 *
 * `code` breaks ties so the log is stable between two renders of the same
 * sheet — an order that reshuffles on refresh reads as broken even when every
 * line in it is right.
 */
function score(quest: Candidate, base: number): number {
  /*
   * Three sources of proximity, in order of how much they are worth trusting: a
   * measured distance, then how attainable the slot is across the corpus, then
   * the neutral fallback. The middle one exists because equip quests have no
   * distance and would otherwise all score the same — every thin sheet handed
   * the same three slots in alphabetical order, which is the failure this
   * feature is most likely to ship with.
   */
  const near = quest.progress?.ratio ?? quest.attainability ?? QUESTS.unknownProximity
  return base * (1 - QUESTS.proximityShare + QUESTS.proximityShare * near)
}

/** A quest before it is scored. `attainability` never leaves this file. */
type Candidate = Omit<Quest, 'weight' | 'difficulty' | 'chain'> & {
  /** Blended with adoption, for ORDER only. */
  attainability?: number
  /**
   * What the thing costs, unblended — the band a founder is shown.
   *
   * Kept apart from `attainability` because mixing adoption into it let a rare
   * field cross a band boundary: marketing channels came out one point under
   * the trivial floor purely because few listings carry any, which is the exact
   * confusion between effort and popularity this was supposed to have settled.
   * Adoption may break a tie in the ordering. It may not change what a founder
   * is told a job costs.
   */
  cost?: number
  chain?: { step: number; of: number } | null
}

/**
 * How far, in four bands.
 *
 * Same proximity the ranker uses, read as a word instead of a multiplier. A
 * quest with no measurable distance takes its slot's attainability, which is
 * the honest stand-in — and a quest with neither lands in the middle rather
 * than at either extreme.
 */
function hardness(quest: Candidate): QuestDifficulty {
  const near = quest.progress?.ratio ?? quest.cost ?? QUESTS.unknownProximity
  if (near >= QUESTS.difficulty.trivial) return 'trivial'
  if (near >= QUESTS.difficulty.easy) return 'easy'
  if (near >= QUESTS.difficulty.standard) return 'standard'
  if (near >= QUESTS.difficulty.hard) return 'hard'
  return 'severe'
}

function ratio(current: number, target: number): number {
  if (target <= 0) return 1
  return Math.min(Math.max(current / target, 0), 1)
}

/** Empty slots, offered as the first rung that would fill them. */
function equipQuests(input: QuestInput): Candidate[] {
  const out: Candidate[] = []
  for (const slot of input.doll) {
    if (slot.item !== null) continue
    const def = SLOTS_BY_KEY.get(slot.slot)
    const first = def?.items[0]
    if (!def || !first) continue
    /*
     * Two different jobs wearing one shape.
     *
     * `unreported` is a slot with no usable value: the advice is to get the
     * number onto the listing. `unearned` is a real figure that landed under
     * the first rung — reported, just small — and telling those founders to go
     * and report it is the mistake this whole file is built to avoid. 1,741 of
     * 4,151 have at least one.
     */
    const short = slot.empty === 'unearned' && slot.value !== null
    out.push({
      code: `equip:${slot.slot}`,
      kind: 'equip',
      title: `Equip your ${slot.label} slot`,
      /*
       * Three slots open at zero — growth, years shipping, cofounders — where
       * "a growth figure of 0.0%" is not a requirement anybody can act on. Those
       * say what is true instead: the slot fills as soon as the stat is on
       * record at all. Still a statement about the slot, never about what the
       * founder did or did not do.
       */
      requirement:
        first.min > 0 ? `${def.stat} of ${def.format(first.min)}` : `${def.stat} — any value`,
      reward: first.name,
      rewardIcon: first.icon,
      rewardRarity: first.rarity,
      // The words on the listing form. See SlotDef.fill for why they are not
      // the words in the API.
      action: short ? `Grow it past ${def.format(first.min)}` : `${def.fill} on TrustMRR`,
      href: input.listingUrl,
      /*
       * A bar only where a number exists. `unearned` has one and it is the
       * whole point of the distinction; `unreported` has no "current" at all,
       * and drawing one from zero would claim a founder is at zero.
       */
      progress: short
        ? { current: slot.value!, target: first.min, ratio: ratio(slot.value!, first.min) }
        : null,
      /*
       * Cost, not popularity. This was `reportedShare` — the share of the
       * corpus with the stat on record — which ordered the log by how many
       * people had bothered and labelled a ten-second tag picker "steep". What
       * it costs is decided by where the number comes from; adoption only
       * breaks ties inside a class.
       */
      attainability:
        QUESTS.effort[def.sourced] * (1 - QUESTS.adoptionNudge) +
        def.reportedShare * QUESTS.adoptionNudge,
      // A short number is business work, not data entry, so it takes the
      // distance band rather than the cost of filling in a form.
      cost: short ? undefined : QUESTS.effort[def.sourced],
      chain: { step: 1, of: def.items.length },
    })
  }
  return out
}

/** Worn slots that have a rung above them. `next` is already computed. */
function upgradeQuests(input: QuestInput): Candidate[] {
  const out: Candidate[] = []
  for (const slot of input.doll) {
    const next = slot.item?.next
    if (!slot.item || !next) continue
    /*
     * Nothing a founder can do moves years-shipping or a cofounder count, so
     * the rung above them is not a quest — it is a wait. Equipping those slots
     * is still offered, because putting a founding date on a listing is data
     * entry like any other; it is only the "grow it" half that has no verb.
     */
    if (!SLOTS_BY_KEY.get(slot.slot)?.movable) continue
    out.push({
      code: `upgrade:${slot.slot}`,
      kind: 'upgrade',
      title: `Upgrade your ${slot.label} slot`,
      requirement: `${slot.stat} of ${next.minLabel}`,
      reward: next.name,
      rewardIcon: next.icon,
      rewardRarity: next.rarity.name as RarityName,
      /*
       * Different verb from an equip quest, and the difference is real: this
       * slot already has a number flowing, so the work is to move it. The link
       * still goes to TrustMRR because that is where the new figure has to land
       * before this page can see it.
       */
      action: `Grow it past ${next.minLabel}, then update TrustMRR`,
      href: input.listingUrl,
      progress: {
        current: slot.item.value,
        target: next.min,
        ratio: ratio(slot.item.value, next.min),
      },
      // The rung being aimed at, so a founder sees the arc rather than one step
      // of it. `next.rarity` names it; the ladder's order gives the number.
      chain: (() => {
        const def = SLOTS_BY_KEY.get(slot.slot)
        const step = def?.items.findIndex((i) => i.rarity === next.rarity.name)
        return def && step !== undefined && step >= 0
          ? { step: step + 1, of: def.items.length }
          : null
      })(),
    })
  }
  return out
}

/**
 * Unearned badges that can state a distance.
 *
 * The boolean ones are skipped rather than listed without a bar: "ship a mobile
 * app" is not a quest a log can measure, and an entry that can never show
 * movement is furniture.
 */
function achievementQuests(input: QuestInput): Candidate[] {
  const earned = new Set(input.earned)
  const out: Candidate[] = []
  for (const def of ACHIEVEMENTS) {
    if (earned.has(def.code) || !def.progress) continue
    const p = def.progress(input.progress)
    if (!p || p.target <= 0) continue
    out.push({
      code: `achievement:${def.code}`,
      kind: 'achievement',
      title: `Earn ${def.label}`,
      requirement: def.description,
      reward: def.label,
      rewardIcon: def.icon,
      rewardRarity: def.rarity,
      action: 'Tracked from your TrustMRR listing — keep it current',
      href: input.listingUrl,
      progress: { current: p.current, target: p.target, ratio: ratio(p.current, p.target) },
    })
  }
  return out
}

/** The next level, when there is one. */
function levelQuest(input: QuestInput): Candidate[] {
  const { current, next } = levelBounds(input.level)
  if (next === null) return []
  return [
    {
      code: 'level:next',
      kind: 'level',
      title: `Reach level ${input.level + 1}`,
      requirement: `${usd(next - input.xp)} more lifetime revenue`,
      reward: `Level ${input.level + 1}`,
      // The level's own band, so the row wears the colour the sheet will.
      rewardIcon: STAT_ICONS.level ?? null,
      rewardRarity: rarityFor(input.level + 1).name as RarityName,
      // Levels are lifetime revenue and nothing else, so the instruction can be
      // exact rather than a general nudge to tidy the listing.
      action: 'Lifetime revenue is the only thing that levels you',
      href: input.listingUrl,
      progress: {
        current: input.xp - current,
        target: next - current,
        ratio: ratio(input.xp - current, next - current),
      },
    },
  ]
}

/**
 * One per product with a rung above it.
 *
 * A product is already scored on the Main Hand ladder — that is what the item
 * level beside it on the sheet means — and 650 founders have more than one.
 * Nothing was ever said about any of them: the doll aggregates every product
 * into one weapon, so a founder with three businesses had three numbers folded
 * into a single quest about their total.
 */
function productQuests(input: QuestInput): Candidate[] {
  const slot = SLOTS_BY_KEY.get('mainHand')
  if (!slot) return []
  const out: Candidate[] = []
  for (const product of input.products) {
    const now = scoreOnSlot('mainHand', product.mrrUsd)
    // The first rung it has NOT cleared. A product with no revenue aims at the
    // bottom of the ladder, which is the same arithmetic as an empty slot.
    const step = slot.items.findIndex((item) => product.mrrUsd < item.min)
    const target = step >= 0 ? slot.items[step] : undefined
    if (!target) continue
    out.push({
      code: `product:${product.slug}`,
      kind: 'product',
      title: `Level up ${product.name}`,
      requirement: `${slot.stat} of ${slot.format(target.min)}`,
      reward: now
        ? `Item level ${scoreOnSlot('mainHand', target.min)?.itemLevel ?? ''}`
        : target.name,
      rewardIcon: target.icon,
      rewardRarity: target.rarity,
      action: `${slot.fill} on TrustMRR`,
      href: input.listingUrl,
      progress: {
        current: product.mrrUsd,
        target: target.min,
        ratio: ratio(product.mrrUsd, target.min),
      },
      chain: { step: step + 1, of: slot.items.length },
    })
  }
  return out
}

/**
 * The climb to the next rank, and only where that is a real distance.
 *
 * Gated hard on purpose. The ladder is densely tied — the median gap to the
 * founder above is $0 and 971 founders sit at exactly zero lifetime revenue —
 * so an ungated version would tell half the corpus they are $0 from a better
 * rank. It means something in the first few hundred, where the median gap is
 * thousands, and nothing at all below.
 *
 * It names a rank rather than a person. Putting somebody else's handle in a
 * stranger's quest log is a different product from this one.
 */
function rankQuest(input: QuestInput): Candidate[] {
  const rank = input.rank
  if (!rank || rank.rank <= 1 || rank.aboveRevenueUsd === null) return []
  const gap = rank.aboveRevenueUsd - input.revenueTotalUsd
  if (gap < QUESTS.rankGapMin) return []
  return [
    {
      code: 'rank:next',
      kind: 'rank',
      title: `Climb to rank #${rank.rank - 1}`,
      requirement: `${usd(gap)} more lifetime revenue`,
      reward: `Rank #${rank.rank - 1}`,
      rewardIcon: STAT_ICONS.crest ?? STAT_ICONS.level ?? null,
      rewardRarity: null,
      action: 'Lifetime revenue is what the ladder sorts on',
      href: input.listingUrl,
      progress: {
        current: input.revenueTotalUsd,
        target: rank.aboveRevenueUsd,
        ratio: ratio(input.revenueTotalUsd, rank.aboveRevenueUsd),
      },
      chain: null,
    },
  ]
}

/**
 * The race on your own realm, measured in item level.
 *
 * The best-shaped quest in the log, and the numbers say why. The global ladder
 * is tied at the median, so a global rank quest only works near the top; the
 * realm ladder is ordered by level then item level, and 1,246 founders sit
 * level-tied within eight item levels of the person above them.
 *
 * It is also the only one that closes the loop. Item level is the mean of the
 * gear worn, so the way to climb a realm is to fill or upgrade a slot — which
 * is what every other quest here is already asking for. The rest of the log
 * becomes the method for this one.
 *
 * Nothing is offered to the 1,473 who are tied on item level as well: the
 * ordering below that is alphabetical, and no amount of work closes a gap that
 * is somebody's handle.
 */
function realmQuest(input: QuestInput): Candidate[] {
  const realm = input.realm
  if (!realm || realm.rank <= 1 || input.ilvl === null) return []
  if (realm.aboveLevel === null || realm.aboveIlvl === null) return []
  // Level first: somebody a level ahead is a different quest, and the level
  // quest already covers it.
  if (realm.aboveLevel !== input.level) return []
  const gap = realm.aboveIlvl - input.ilvl
  if (gap < 1 || gap > QUESTS.realmIlvlMax) return []
  return [
    {
      code: 'realm:next',
      kind: 'rank',
      title: `Take #${realm.rank - 1} on the ${realm.realm} realm`,
      requirement: `${gap} more item level${gap > 1 ? 's' : ''}`,
      reward: `#${realm.rank - 1} of ${realm.total}`,
      rewardIcon: STAT_ICONS.crest ?? null,
      rewardRarity: null,
      action: 'Item level is the average of the gear you are wearing',
      href: null,
      progress: {
        current: input.ilvl,
        target: realm.aboveIlvl,
        ratio: ratio(input.ilvl, realm.aboveIlvl),
      },
      chain: null,
    },
  ]
}

/**
 * Finish the set — the reference's oldest carrot, and one the sheet already
 * counts toward without ever naming.
 *
 * Only near the end. "Fill fifteen slots" is not a quest, it is a description
 * of being new, and the equip quests are already saying it one slot at a time.
 */
function setQuest(input: QuestInput): Candidate[] {
  const worn = input.doll.filter((s) => s.item !== null).length
  const left = input.doll.length - worn
  if (left === 0 || left > QUESTS.setWithin) return []
  return [
    {
      code: 'set:full',
      kind: 'set',
      title: 'Complete the set',
      requirement: `${left} slot${left > 1 ? 's' : ''} left of ${input.doll.length}`,
      reward: 'Every slot worn',
      rewardIcon: STAT_ICONS.gear ?? null,
      rewardRarity: null,
      action: 'Each empty slot above says what fills it',
      href: input.listingUrl,
      progress: { current: worn, target: input.doll.length, ratio: worn / input.doll.length },
      chain: null,
    },
  ]
}

function usd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(Math.max(value, 0))
}

/** Every kind, in the order the rules page lists them. */
export const QUEST_KINDS: readonly QuestKind[] = [
  'equip',
  'upgrade',
  'product',
  'achievement',
  'level',
  'rank',
  'set',
]

/**
 * What finished since the corpus started watching.
 *
 * The only part of a sheet that differs on a second visit. Everything else is a
 * photograph: the same numbers, the same advice, until a threshold moves. A
 * founder has no reason to come back to a photograph.
 *
 * Derived from the snapshot history rather than stored, on the same argument as
 * the rest of this file — a crossing is a fact already sitting in the table, and
 * a `completed_quests` row would be a cache of it that could quietly disagree.
 *
 * Only two ladders can be read this way, because history carries two numbers:
 * MRR and lifetime revenue. That is the Main Hand and the Off Hand, plus the
 * level those feed. Reading the other fifteen would need a snapshot of the whole
 * aggregate per day, which is a table this does not deserve yet.
 */
export function questsDone(
  history: { day: string; mrrUsd: number; revenueTotalUsd: number }[],
  levelAt: (revenueTotalUsd: number) => number,
): QuestDone[] {
  if (history.length < 2) return []
  const days = [...history].sort((a, b) => a.day.localeCompare(b.day))
  const out: QuestDone[] = []

  for (let i = 1; i < days.length; i++) {
    const was = days[i - 1]!
    const now = days[i]!

    for (const [key, slot, from, to] of [
      ['mainHand', 'Main Hand', was.mrrUsd, now.mrrUsd],
      ['offHand', 'Off Hand', was.revenueTotalUsd, now.revenueTotalUsd],
    ] as const) {
      /*
       * Both observations have to be real numbers.
       *
       * A jump from zero is almost never a first sale: it is the crawl finally
       * seeing a figure that was already there. One founder in the sample
       * "equipped" their Off Hand and reached level 36 on the same day, which
       * takes a hundred thousand in lifetime revenue — the money was not new,
       * the reading was. Zero and absent are the same value in this corpus, so
       * a crossing out of zero cannot be told from data arriving, and the sheet
       * does not congratulate people for things it cannot verify happened.
       */
      if (from <= 0) continue
      const before = scoreOnSlot(key, from)
      const after = scoreOnSlot(key, to)
      // A rung crossing, not a number going up: the sheet only changes visibly
      // when the quality does, and that is what somebody would notice.
      if (after && after.rarity.name !== before?.rarity.name && to > from) {
        /*
         * Crossing INTO the bottom rung is the slot becoming equipped at all —
         * a first dollar, a first sale — and "Main Hand reached common" is a
         * flat way to say the best news a founder gets. Every rung above it is
         * a quality and reads as one.
         */
        out.push({
          code: `done:${key}:${after.rarity.name}:${now.day}`,
          line: `${slot} reached ${after.rarity.name}`,
          on: now.day,
        })
      }
    }

    // Same guard as the rungs, for the same reason: a level computed off a
    // revenue that was zero yesterday is the crawl catching up, not a founder
    // levelling. Somebody does not go from no revenue to level 36 overnight.
    const wasLevel = levelAt(was.revenueTotalUsd)
    const nowLevel = levelAt(now.revenueTotalUsd)
    if (was.revenueTotalUsd > 0 && nowLevel > wasLevel) {
      out.push({
        code: `done:level:${nowLevel}:${now.day}`,
        line: `Reached level ${nowLevel}`,
        on: now.day,
      })
    }
  }

  // Newest first, and only the recent handful: a log of everything that ever
  // happened is a history page, which this is not.
  return out.sort((a, b) => b.on.localeCompare(a.on)).slice(0, QUESTS.doneShown)
}
