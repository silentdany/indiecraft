import { describe, expect, it } from 'vitest'
import {
  achievementsFrom,
  classFrom,
  computeCharacter,
  ilvlFrom,
  itemLevelFor,
  levelFromXp,
  rarityFor,
  xpFrom,
} from './character'
import { CLASS_RULES, LEVEL_THRESHOLDS, MAX_LEVEL } from './tuning'
import type { FounderAggregate } from './types'

/**
 * Mirrors what aggregateFounder derives, so a test that sets `customers` gets
 * a coherent aggregate instead of a hand-assembled impossible one.
 */
function founder(overrides: Partial<FounderAggregate> = {}): FounderAggregate {
  const base: FounderAggregate = {
    handle: 'test',
    revenueTotalUsd: 0,
    mrrUsd: 0,
    customers: 0,
    activeSubscriptions: 0,
    nProducts: 0,
    retention: 0,
    hasRetentionSignal: false,
    effectiveCustomers: 0,
    growthMrr30d: 0,
    domainRating: null,
    foundedFirst: null,
    channels: [],
    stack: [],
    cofounders: [],
    fundingStatuses: [],
    ...overrides,
  }
  return {
    ...base,
    hasRetentionSignal: overrides.hasRetentionSignal ?? base.customers > 0,
    effectiveCustomers:
      overrides.effectiveCustomers ??
      (base.customers > 0 ? base.customers : base.activeSubscriptions),
  }
}

describe('level table', () => {
  it('has exactly 60 rows', () => {
    expect(LEVEL_THRESHOLDS).toHaveLength(60)
    expect(MAX_LEVEL).toBe(60)
  })

  it('is strictly increasing', () => {
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
      expect(LEVEL_THRESHOLDS[i]!).toBeGreaterThan(LEVEL_THRESHOLDS[i - 1]!)
    }
  })

  it('hits every anchor from the spec', () => {
    const anchors: [number, number][] = [
      [1, 1],
      [100, 10],
      [1_000, 20],
      [10_000, 30],
      [100_000, 40],
      [1_000_000, 50],
      [10_000_000, 60],
    ]
    for (const [xp, level] of anchors) {
      expect(levelFromXp(xp)).toBe(level)
    }
  })
})

describe('levelFromXp', () => {
  it('clamps at the bottom: nobody drops below 1', () => {
    expect(levelFromXp(0)).toBe(1)
    expect(levelFromXp(-100)).toBe(1)
    expect(levelFromXp(Number.NaN)).toBe(1)
  })

  it('clamps at the top: nobody exceeds 60', () => {
    expect(levelFromXp(10_000_000)).toBe(60)
    expect(levelFromXp(999_999_999)).toBe(60)
  })

  it('dings level 1 on the first dollar', () => {
    expect(levelFromXp(1)).toBe(1)
    expect(levelFromXp(2)).toBe(2)
  })

  it('takes the last threshold reached, never the next one', () => {
    expect(levelFromXp(999)).toBe(19)
    expect(levelFromXp(1_000)).toBe(20)
    expect(levelFromXp(1_001)).toBe(20)
  })
})

describe('xp', () => {
  it('adds lifetime revenue and the per-product grant', () => {
    expect(xpFrom(founder({ revenueTotalUsd: 1_000, nProducts: 2 }))).toBe(2_000)
  })

  it('moves a founder who ships without charging', () => {
    const sheet = computeCharacter(founder({ nProducts: 5 }))
    expect(sheet.xp).toBe(2_500)
    expect(sheet.level).toBeGreaterThan(20)
  })
})

describe('ilvl', () => {
  it('is the level twelve months of current MRR would be worth', () => {
    // $1,000/mo → $12,000/yr → level 30 (threshold 10,000).
    expect(ilvlFrom(founder({ mrrUsd: 1_000 }))).toBe(30)
  })

  it('adds +1 per 10% of growth, capped at +5', () => {
    expect(ilvlFrom(founder({ mrrUsd: 1_000, growthMrr30d: 25 }))).toBe(32)
    expect(ilvlFrom(founder({ mrrUsd: 1_000, growthMrr30d: 500 }))).toBe(35)
  })

  it('penalizes retention below 30%', () => {
    const a = founder({
      mrrUsd: 1_000,
      customers: 100,
      activeSubscriptions: 10,
      retention: 0.1,
    })
    // (0.30 - 0.10) / 0.05 = 4 bands.
    expect(ilvlFrom(a)).toBe(26)
  })

  it('NEVER penalizes when activeSubscriptions is 0', () => {
    // One-time-purchase boilerplate seller: retention is structurally zero.
    // Punishing them for their business model would be a product bug.
    const a = founder({ mrrUsd: 1_000, customers: 500, activeSubscriptions: 0, retention: 0 })
    expect(ilvlFrom(a)).toBe(30)
  })

  it('NEVER penalizes when there is no retention signal at all', () => {
    // TrustMRR sends customers: 0 on most listings. That is missing data, not
    // total churn, and it must never cost anyone item levels.
    const a = founder({
      mrrUsd: 1_000,
      customers: 0,
      activeSubscriptions: 101_590,
      retention: 0,
      hasRetentionSignal: false,
    })
    expect(ilvlFrom(a)).toBe(30)
  })

  it('stays clamped to [1, 60]', () => {
    expect(ilvlFrom(founder({ mrrUsd: 5_000_000, growthMrr30d: 90 }))).toBe(60)
  })

  it('is null without recurring revenue, never 1', () => {
    // iLvl asks what twelve months of current MRR would be worth. With no MRR
    // the question has no answer, and 1 reads as "worst possible gear" when the
    // truth is "this does not apply to how they sell". Same mistake the
    // retention penalty already guards against.
    expect(ilvlFrom(founder({ mrrUsd: 0, revenueTotalUsd: 878_595_860 }))).toBeNull()
    expect(computeCharacter(founder({ mrrUsd: 0, nProducts: 1 })).ilvlDelta).toBeNull()
  })

  it('still scores a founder earning almost nothing', () => {
    // The rule is "no recurring revenue", not "not much": $5/mo is $60 a year,
    // which is a real answer and must stay a number.
    expect(ilvlFrom(founder({ mrrUsd: 5 }))).toBe(9)
  })
})

describe('class', () => {
  it('returns Adventurer with no product', () => {
    expect(classFrom(founder(), 1)).toBe('Adventurer')
  })

  it('returns Adventurer below level 5 regardless of other rules', () => {
    const a = founder({ nProducts: 1, stack: ['anthropic'] })
    expect(classFrom(a, 4)).toBe('Adventurer')
    expect(classFrom(a, 5)).toBe('Mage')
  })

  it('returns Mage on an AI stack', () => {
    expect(classFrom(founder({ nProducts: 1, stack: ['openai'] }), 20)).toBe('Mage')
    expect(classFrom(founder({ nProducts: 1, stack: ['anthropic'] }), 20)).toBe('Mage')
  })

  it('uses the real channel slugs, not the invented ones', () => {
    // `x-twitter` was guessed and does not exist; the slug is `twitter`. The
    // old rule looked correct and matched nobody.
    expect(classFrom(founder({ nProducts: 1, channels: ['twitter'] }), 20)).toBe('Bard')
    expect(classFrom(founder({ nProducts: 1, channels: ['x-twitter'] }), 20)).not.toBe('Bard')
  })

  describe('Hunter', () => {
    it('needs domain rating alongside an SEO channel', () => {
      expect(classFrom(founder({ nProducts: 1, channels: ['seo'], domainRating: 40 }), 20)).toBe(
        'Hunter',
      )
      expect(
        classFrom(founder({ nProducts: 1, channels: ['seo'], domainRating: 10 }), 20),
      ).not.toBe('Hunter')
    })

    it('accepts a strong domain rating on its own', () => {
      // Only 22% of listings report marketing channels, but 62% report a domain
      // rating. DR 50 is earned, and it is the Authority threshold too.
      expect(classFrom(founder({ nProducts: 1, domainRating: 50 }), 20)).toBe('Hunter')
      expect(classFrom(founder({ nProducts: 1, domainRating: 49 }), 20)).not.toBe('Hunter')
    })
  })

  it('returns Warlock on paid acquisition', () => {
    expect(classFrom(founder({ nProducts: 1, channels: ['google-ads'] }), 20)).toBe('Warlock')
    expect(classFrom(founder({ nProducts: 1, channels: ['meta-ads'] }), 20)).toBe('Warlock')
  })

  it('prefers paid over audience when a founder does both', () => {
    const a = founder({ nProducts: 1, channels: ['twitter', 'google-ads'] })
    expect(classFrom(a, 20)).toBe('Warlock')
  })

  it('returns Priest only with a real retention signal', () => {
    const measured = founder({
      nProducts: 1,
      customers: 100,
      activeSubscriptions: 90,
      retention: 0.9,
    })
    expect(classFrom(measured, 20)).toBe('Priest')

    // customers: 0 is missing data, not perfect churn. It must never be read as
    // retention either way.
    const unmeasured = founder({
      nProducts: 1,
      customers: 0,
      activeSubscriptions: 5_000,
      retention: 0.9,
      hasRetentionSignal: false,
    })
    expect(classFrom(unmeasured, 20)).not.toBe('Priest')
  })

  it('returns Monk for real lifetime revenue with no recurring revenue', () => {
    // Gumroad's shape: hundreds of millions earned, zero MRR. A business model,
    // not a gap in the data.
    const a = founder({ nProducts: 1, revenueTotalUsd: 878_595_860, mrrUsd: 0 })
    expect(classFrom(a, 60)).toBe('Monk')
  })

  it('does not call someone a Monk for having earned nothing yet', () => {
    expect(classFrom(founder({ nProducts: 1, revenueTotalUsd: 0, mrrUsd: 0 }), 20)).toBe(
      'Adventurer',
    )
  })

  it('returns Rogue on a high ticket', () => {
    const a = founder({ nProducts: 1, customers: 10, activeSubscriptions: 10, mrrUsd: 5_000 })
    expect(classFrom(a, 30)).toBe('Rogue')
  })

  it('returns Warrior on volume at a low ticket', () => {
    const a = founder({ nProducts: 1, customers: 1_000, activeSubscriptions: 1_000, mrrUsd: 5_000 })
    expect(classFrom(a, 30)).toBe('Warrior')
  })

  it('returns Paladin for the ordinary bootstrapped SaaS', () => {
    // 200 subscribers at $50. No standout signal, and previously no class:
    // the most ordinary founder on the ladder was labelled "we don't know".
    const a = founder({ nProducts: 1, customers: 200, activeSubscriptions: 200, mrrUsd: 10_000 })
    expect(classFrom(a, 40)).toBe('Paladin')
  })

  it('sizes the business off subscriptions when customers is missing', () => {
    // The whole reason two thirds of the ladder used to be Adventurer.
    const a = founder({ nProducts: 1, customers: 0, activeSubscriptions: 3_618, mrrUsd: 185_870 })
    expect(classFrom(a, 50)).toBe('Paladin')
  })

  it('falls back to Adventurer when the data says nothing, never anything else', () => {
    expect(classFrom(founder({ nProducts: 1, mrrUsd: 39, revenueTotalUsd: 0 }), 20)).toBe(
      'Adventurer',
    )
  })

  it('never leaves a class that could read as an insult', () => {
    // Every rule must be phrased as something earned. If a reason ever reads as
    // a verdict on the person, it does not ship.
    for (const rule of CLASS_RULES) {
      expect(rule.reason.length).toBeGreaterThan(0)
      expect(rule.class).not.toBe('')
    }
  })
})

describe('rarity', () => {
  it('follows the bands from the spec', () => {
    expect(rarityFor(1).hex).toBe('#9d9d9d')
    expect(rarityFor(9).hex).toBe('#9d9d9d')
    expect(rarityFor(10).hex).toBe('#1eff00')
    expect(rarityFor(24).hex).toBe('#1eff00')
    expect(rarityFor(25).hex).toBe('#0070dd')
    expect(rarityFor(39).hex).toBe('#0070dd')
    expect(rarityFor(40).hex).toBe('#a335ee')
    expect(rarityFor(54).hex).toBe('#a335ee')
    expect(rarityFor(55).hex).toBe('#ff8000')
    expect(rarityFor(60).hex).toBe('#ff8000')
  })
})

describe('achievements', () => {
  it('fire at the advertised thresholds', () => {
    expect(achievementsFrom(founder({ revenueTotalUsd: 1 }), 1)).toContain('first_blood')
    expect(achievementsFrom(founder({ revenueTotalUsd: 1_000 }), 20)).toContain('the_thousand')
    expect(achievementsFrom(founder({ mrrUsd: 1_000 }), 20)).toContain('ramen')
    expect(achievementsFrom(founder({ mrrUsd: 10_000 }), 30)).toContain('raid_boss')
    expect(achievementsFrom(founder({ customers: 100 }), 10)).toContain('hundred_customers')
    expect(achievementsFrom(founder({ nProducts: 3 }), 20)).toContain('multiboxer')
    expect(achievementsFrom(founder({ growthMrr30d: 20 }), 10)).toContain('ascension')
    expect(achievementsFrom(founder({ domainRating: 50 }), 10)).toContain('authority')
    expect(achievementsFrom(founder(), 60)).toContain('ding_sixty')
  })

  it('does not grant Lone Wolf to someone who never shipped', () => {
    expect(achievementsFrom(founder(), 1)).not.toContain('lone_wolf')
    expect(achievementsFrom(founder({ nProducts: 1 }), 10)).toContain('lone_wolf')
  })

  it('keeps Lone Wolf and Guilded mutually exclusive', () => {
    const solo = achievementsFrom(founder({ nProducts: 2 }), 20)
    expect(solo).toContain('lone_wolf')
    expect(solo).not.toContain('guilded')

    const guild = achievementsFrom(founder({ nProducts: 2, cofounders: ['friend'] }), 20)
    expect(guild).toContain('guilded')
    expect(guild).not.toContain('lone_wolf')
  })

  it('grants Veteran past two years, not before', () => {
    const old = new Date(Date.now() - 3 * 365 * 864e5).toISOString()
    const recent = new Date(Date.now() - 30 * 864e5).toISOString()
    expect(achievementsFrom(founder({ foundedFirst: old }), 10)).toContain('veteran')
    expect(achievementsFrom(founder({ foundedFirst: recent }), 10)).not.toContain('veteran')
  })
})

describe('full sheet', () => {
  it('exposes the iLvl gap, the one number worth showing', () => {
    // High lifetime revenue, collapsed MRR: veteran in a trough.
    const veteran = computeCharacter(
      founder({ revenueTotalUsd: 500_000, mrrUsd: 100, nProducts: 2 }),
    )
    expect(veteran.level).toBe(47)
    expect(veteran.ilvlDelta).toBeLessThan(0)

    // Little lifetime revenue, MRR taking off: gear above the tier.
    const rocket = computeCharacter(
      founder({ revenueTotalUsd: 3_000, mrrUsd: 2_000, nProducts: 1 }),
    )
    expect(rocket.ilvlDelta).toBeGreaterThan(0)
  })

  it('clamps progress to [0, 1] and fills it at max level', () => {
    // 1,600 + 500 = 2,100 XP: level 23 (threshold 2,000), next threshold 2,500.
    const mid = computeCharacter(founder({ revenueTotalUsd: 1_600, nProducts: 1 }))
    expect(mid.level).toBe(23)
    expect(mid.progress.ratio).toBeCloseTo(0.2)
    expect(mid.progress.ratio).toBeLessThan(1)

    const capped = computeCharacter(founder({ revenueTotalUsd: 50_000_000, nProducts: 1 }))
    expect(capped.level).toBe(60)
    expect(capped.progress.next).toBeNull()
    expect(capped.progress.ratio).toBe(1)
  })
})

describe('gear', () => {
  it('gives each product its own item level', () => {
    expect(itemLevelFor(1_000)).toBe(30)
    expect(itemLevelFor(10_000)).toBe(40)
  })

  it('gives no item level to a product that does not bill monthly', () => {
    expect(itemLevelFor(0)).toBeNull()
  })
})
