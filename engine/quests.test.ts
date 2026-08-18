import { describe, expect, it } from 'vitest'
import { equipmentFor, equipmentInput } from './equipment'
import { completion, questsFor } from './quests'
import { QUESTS } from './tuning'
import type { AchievementProgressInput, FounderAggregate, QuestInput } from './types'

function aggregate(over: Partial<FounderAggregate> = {}): FounderAggregate {
  return {
    handle: 'someone',
    revenueTotalUsd: 0,
    mrrUsd: 0,
    last30dUsd: 0,
    customers: 0,
    activeSubscriptions: 0,
    nProducts: 1,
    retention: 0,
    hasRetentionSignal: false,
    effectiveCustomers: 0,
    growthMrr30d: 0,
    domainRating: null,
    followers: null,
    foundedFirst: null,
    channels: [],
    stack: [],
    cofounders: [],
    fundingStatuses: [],
    visitors30d: 0,
    categories: [],
    hasMobileApp: false,
    profitMargin30d: null,
    googleImpressions30d: 0,
    everListedForSale: false,
    allProductsEarning: false,
    realm: null,
    faction: null,
    ...over,
  }
}

function progress(over: Partial<AchievementProgressInput> = {}): AchievementProgressInput {
  return {
    revenueTotalUsd: 0,
    mrrUsd: 0,
    customers: 0,
    activeSubscriptions: 0,
    nProducts: 1,
    retention: 0,
    hasRetentionSignal: false,
    growthMrr30d: 0,
    domainRating: null,
    level: 1,
    cofounders: 0,
    visitors30d: 0,
    categories: 0,
    stackSize: 0,
    profitMargin30d: null,
    googleImpressions30d: 0,
    productsEarning: 0,
    ...over,
  }
}

function input(over: Partial<QuestInput> = {}, agg: Partial<FounderAggregate> = {}): QuestInput {
  return {
    doll: equipmentFor(equipmentInput(aggregate(agg), 'Adventurer')),
    earned: [],
    progress: progress(),
    level: 1,
    xp: 0,
    ...over,
  }
}

describe('completion', () => {
  it('is worn slots over the whole doll', () => {
    const bare = input({}, {})
    const worn = bare.doll.filter((s) => s.item !== null).length
    expect(completion(bare)).toBeCloseTo(worn / bare.doll.length)
  })
})

describe('questsFor', () => {
  it('offers an empty slot as the first rung that would fill it', () => {
    const quests = questsFor(input())
    const ranged = quests.find((q) => q.code === 'equip:ranged')
    expect(ranged).toBeDefined()
    expect(ranged?.kind).toBe('equip')
    expect(ranged?.reward).toContain('Crude Traffic Bow')
  })

  /*
   * The constraint that shaped every string in this file. TrustMRR sends 0 for
   * a field nobody filled in, so a quest cannot tell a founder what they did or
   * did not report without being wrong about half the time.
   */
  it('never claims a founder failed to report anything', () => {
    const text = questsFor(input())
      .flatMap((q) => [q.title, q.requirement, q.reward])
      .join(' ')
      .toLowerCase()
    for (const phrase of ['not reported', 'unreported', 'missing', 'you have not', "you haven't"]) {
      expect(text, phrase).not.toContain(phrase)
    }
  })

  it('draws no progress bar for a slot with no usable value', () => {
    // A bar from zero would state the founder is at zero, which is the claim
    // the corpus cannot support.
    expect(questsFor(input()).find((q) => q.code === 'equip:ranged')?.progress).toBeNull()
  })

  it('offers the next rung of a worn slot, with a real distance', () => {
    const quests = questsFor(input({}, { mrrUsd: 1_500 }))
    const upgrade = quests.find((q) => q.code === 'upgrade:mainHand')
    expect(upgrade?.kind).toBe('upgrade')
    // 1,500 against the epic floor of 10,000.
    expect(upgrade?.progress).toMatchObject({ current: 1_500, target: 10_000 })
    expect(upgrade?.progress?.ratio).toBeCloseTo(0.15)
  })

  it('skips a badge already earned, and one that cannot show a distance', () => {
    const withBadge = questsFor(input({ earned: ['ding_sixty'] }))
    expect(withBadge.some((q) => q.code === 'achievement:ding_sixty')).toBe(false)
    // Booleans have no bar to draw, so they are not offered at all.
    expect(withBadge.some((q) => q.code === 'achievement:mobile')).toBe(false)
  })

  it('stops at max level rather than offering a level 61', () => {
    expect(questsFor(input({ level: 60 })).some((q) => q.kind === 'level')).toBe(false)
  })

  it('is stable: the same sheet twice gives the same order', () => {
    const one = questsFor(input({}, { mrrUsd: 900 })).map((q) => q.code)
    const two = questsFor(input({}, { mrrUsd: 900 })).map((q) => q.code)
    expect(one).toEqual(two)
  })

  describe('the two phases', () => {
    /*
     * The whole point of the feature: a thin sheet is pushed to fill in, a
     * dressed one is pushed to grow. Asserted through the ranking rather than
     * by reading the phase, because the phase is an implementation detail and
     * the order is the product.
     */
    const dressed: Partial<FounderAggregate> = {
      mrrUsd: 30_000,
      last30dUsd: 34_000,
      revenueTotalUsd: 400_000,
      customers: 400,
      activeSubscriptions: 380,
      nProducts: 3,
      growthMrr30d: 25,
      domainRating: 62,
      visitors30d: 40_000,
      profitMargin30d: 88,
      followers: 12_000,
      channels: ['seo', 'twitter', 'newsletter'],
      stack: ['nextjs', 'stripe', 'postgresql', 'vercel', 'react', 'typescript'],
      cofounders: ['someone'],
      categories: ['Artificial Intelligence', 'Marketing'],
      foundedFirst: '2019-01-01',
    }

    it('puts equipping first while the sheet is thin', () => {
      const thin = input()
      expect(completion(thin)).toBeLessThan(QUESTS.completeAt)
      expect(questsFor(thin)[0]?.kind).toBe('equip')
    })

    it('stops leading with equipping once the sheet is dressed', () => {
      const full = input({}, dressed)
      expect(completion(full)).toBeGreaterThanOrEqual(QUESTS.completeAt)
      expect(questsFor(full)[0]?.kind).not.toBe('equip')
    })
  })
})
