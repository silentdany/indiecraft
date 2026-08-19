import { levelBounds, rarityFor } from './character'
import { ACHIEVEMENTS, QUESTS, SLOTS_BY_KEY, STAT_ICONS } from './tuning'
import type { Quest, QuestInput, QuestKind, RarityName } from './types'

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
    .map(({ attainability: _internal, ...q }) => ({ ...q, weight: 0 }))
    .map((q, i) => ({ ...q, weight: score(quests[i]!, weights[q.kind]) }))
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
type Candidate = Omit<Quest, 'weight'> & { attainability?: number }

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
      /*
       * The stat is not repeated here on purpose. Three of the seventeen labels
       * are column headings rather than nouns — "Shipping for", "Per customer",
       * "Last 30 days" — and "Set your shipping for on your listing" is not a
       * sentence. The requirement directly above already names the number, so
       * the action only has to name the place.
       */
      action: 'Set it on your TrustMRR listing',
      href: input.listingUrl,
      /*
       * No bar. 'unearned' would have a real distance, but 'unreported' has no
       * "current" at all, and drawing one from zero would claim a founder is at
       * zero — the exact claim the docblock above forbids. One kind of quest
       * cannot draw a bar on some sheets and not others without the blank
       * reading as the bad news.
       */
      progress: null,
      attainability: def.reportedShare,
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

function usd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(Math.max(value, 0))
}

/** The kinds, in the order the tuning table lists them. Handy for tests and docs. */
export const QUEST_KINDS: readonly QuestKind[] = ['equip', 'upgrade', 'achievement', 'level']
