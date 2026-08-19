import { describe, expect, it } from 'vitest'
import { levelFromXp } from './character'
import { equipmentFor, equipmentInput } from './equipment'
import { completion, questsDone, questsFor } from './quests'
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
    listingUrl: 'https://trustmrr.com/founder/someone',
    products: [],
    rank: null,
    realm: null,
    ilvl: null,
    revenueTotalUsd: 0,
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
  it('tells a founder where the number is entered', () => {
    // The condition alone is not a quest: the first person to read "Followers
    // of 1" had no idea where a follower count is declared.
    const ranged = questsFor(input()).find((q) => q.code === 'equip:ranged')
    expect(ranged?.action).toContain('TrustMRR')
    expect(ranged?.href).toBe('https://trustmrr.com/founder/someone')
  })

  it('never claims a founder failed to report anything', () => {
    const text = questsFor(input())
      .flatMap((q) => [q.title, q.requirement, q.reward, q.action])
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

  it('never offers a rung that only time can reach', () => {
    // Ring 1 is years shipping. A founder who has shipped for one year cannot
    // act on "reach two", and a log that says so has spent its credibility.
    const shipping = questsFor(input({}, { foundedFirst: '2024-01-01' }))
    expect(shipping.some((q) => q.code === 'upgrade:ring1')).toBe(false)
    expect(shipping.some((q) => q.code === 'upgrade:ring2')).toBe(false)
    // The equip half survives: declaring a founding date is data entry.
    const bare = questsFor(input())
    expect(bare.some((q) => q.code === 'equip:ring1')).toBe(true)
  })

  it('stops at max level rather than offering a level 61', () => {
    expect(questsFor(input({ level: 60 })).some((q) => q.kind === 'level')).toBe(false)
  })

  it('is stable: the same sheet twice gives the same order', () => {
    const one = questsFor(input({}, { mrrUsd: 900 })).map((q) => q.code)
    const two = questsFor(input({}, { mrrUsd: 900 })).map((q) => q.code)
    expect(one).toEqual(two)
  })

  it('gives each product its own quest, on the Main Hand ladder', () => {
    // The doll folds every product into one weapon, so a founder with three
    // businesses had three numbers hidden inside a single quest about the sum.
    const quests = questsFor(
      input({ products: [{ slug: 'flexco', name: 'FlexCo', mrrUsd: 400 }] }, { mrrUsd: 400 }),
    )
    const p = quests.find((q) => q.code === 'product:flexco')
    expect(p?.title).toBe('Level up FlexCo')
    // $400 against the rare floor of $1,000.
    expect(p?.progress).toMatchObject({ current: 400, target: 1_000 })
    expect(p?.chain).toEqual({ step: 3, of: 5 })
  })

  /*
   * The gate is the whole feature. The ladder is densely tied — median gap to
   * the founder above is $0, and 971 founders sit at exactly zero revenue — so
   * ungated this would tell half the corpus they are $0 from a better rank.
   */
  it('only offers a rank climb when the gap is a real distance', () => {
    const tied = questsFor(input({ rank: { rank: 900, aboveRevenueUsd: 10 }, revenueTotalUsd: 10 }))
    expect(tied.some((q) => q.kind === 'rank')).toBe(false)

    const real = questsFor(
      input({ rank: { rank: 12, aboveRevenueUsd: 90_000 }, revenueTotalUsd: 50_000 }),
    )
    const climb = real.find((q) => q.kind === 'rank')
    expect(climb?.title).toBe('Climb to rank #11')
    // A rank, never a person: somebody else's handle in a stranger's quest log
    // is a different product from this one.
    expect(climb?.requirement).toBe('$40K more lifetime revenue')
  })

  it('asks for the full set only when it is nearly done', () => {
    const bare = questsFor(input())
    expect(bare.some((q) => q.kind === 'set')).toBe(false)
  })

  it('reads a chain step off the ladder rather than counting quests', () => {
    const mid = questsFor(input({}, { mrrUsd: 1_500 })).find((q) => q.code === 'upgrade:mainHand')
    // $1,500 sits on the rare rung, so the quest aims at the fourth of five.
    expect(mid?.chain).toEqual({ step: 4, of: 5 })
  })

  /*
   * The reference's own scale, grey through red, rather than the close/fair/
   * steep vocabulary this invented for a thing that already had one. The words
   * only ever reach a `title` attribute; the colour is the label.
   */
  it('bands a quest on the difficulty scale the game uses', () => {
    const near = questsFor(input({}, { mrrUsd: 9_000 })).find((q) => q.code === 'upgrade:mainHand')
    expect(near?.difficulty).toBe('trivial')
    const far = questsFor(input({}, { mrrUsd: 1_100 })).find((q) => q.code === 'upgrade:mainHand')
    expect(far?.difficulty).toBe('severe')
    // A slot you fill by typing is grey: it costs ten seconds, which is what
    // the game's grey has always meant.
    const typed = questsFor(input()).find((q) => q.code === 'equip:trinket2')
    expect(typed?.difficulty).toBe('trivial')
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
      // Derived in the real aggregate, literal in this fixture — and the two
      // slots that read it were the last blanks keeping "dressed" from meaning
      // seventeen of seventeen.
      effectiveCustomers: 400,
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

    it('puts equipping first while any slot is blank', () => {
      const thin = input()
      expect(questsFor(thin)[0]?.kind).toBe('equip')
    })

    /*
     * The regression that named the rule. A founder at 82% equipped was being
     * told to raise a domain rating — a season of SEO — while a profit margin
     * and a channel list sat empty behind one form, because a completion
     * percentage counted 82% as done. One blank is enough.
     */
    it('leads with the blank even on a nearly-dressed sheet', () => {
      const nearly = input({}, { ...dressed, profitMargin30d: null, channels: [] })
      const worn = nearly.doll.filter((s) => s.item !== null).length
      expect(worn).toBeGreaterThan(nearly.doll.length * 0.75)
      expect(questsFor(nearly)[0]?.kind).toBe('equip')
    })

    it('turns to growth only once nothing is blank', () => {
      const full = input({}, dressed)
      expect(completion(full)).toBe(1)
      expect(questsFor(full)[0]?.kind).not.toBe('equip')
    })
  })
})

/*
 * The only part of a sheet that differs on a second visit. Everything else is a
 * photograph — the same numbers and the same advice until a threshold moves.
 */
describe('questsDone', () => {
  const levelAt = (revenue: number) => levelFromXp(revenue)

  it('says nothing without two days to compare', () => {
    expect(questsDone([{ day: '2026-08-01', mrrUsd: 0, revenueTotalUsd: 0 }], levelAt)).toEqual([])
  })

  it('reports a rung crossed, not a number going up', () => {
    const done = questsDone(
      [
        { day: '2026-08-01', mrrUsd: 900, revenueTotalUsd: 0 },
        { day: '2026-08-02', mrrUsd: 950, revenueTotalUsd: 0 },
        { day: '2026-08-03', mrrUsd: 1_400, revenueTotalUsd: 0 },
      ],
      levelAt,
    )
    // 900 -> 950 stays uncommon and is silent; 950 -> 1,400 crosses into rare.
    expect(done).toHaveLength(1)
    expect(done[0]).toMatchObject({ line: 'Main Hand reached rare', on: '2026-08-03' })
  })

  /*
   * The guard that cut the result from 326 founders to 184, and was worth it.
   * Zero and absent are the same value in this corpus, so a jump out of zero is
   * almost always the crawl catching up: one founder "earned their first
   * dollar" and reached level 36 on the same day, which takes six figures.
   */
  it('will not read a jump out of zero as progress', () => {
    const done = questsDone(
      [
        { day: '2026-08-01', mrrUsd: 0, revenueTotalUsd: 0 },
        { day: '2026-08-02', mrrUsd: 40_000, revenueTotalUsd: 400_000 },
      ],
      levelAt,
    )
    expect(done).toEqual([])
  })

  it('never celebrates a fall', () => {
    const done = questsDone(
      [
        { day: '2026-08-01', mrrUsd: 12_000, revenueTotalUsd: 0 },
        { day: '2026-08-02', mrrUsd: 200, revenueTotalUsd: 0 },
      ],
      levelAt,
    )
    expect(done).toEqual([])
  })
})
