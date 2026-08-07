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
import { LEVEL_THRESHOLDS, MAX_LEVEL } from './tuning'
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
    expect(ilvlFrom(founder({ mrrUsd: 0 }))).toBe(1)
    expect(ilvlFrom(founder({ mrrUsd: 5_000_000, growthMrr30d: 90 }))).toBe(60)
  })
})

describe('class', () => {
  it('returns Adventurer with no product', () => {
    expect(classFrom(founder(), 1)).toBe('Adventurer')
  })

  it('returns Adventurer below level 5 regardless of other rules', () => {
    const a = founder({ nProducts: 1, customers: 100, activeSubscriptions: 90, retention: 0.9 })
    expect(classFrom(a, 4)).toBe('Adventurer')
    expect(classFrom(a, 5)).toBe('Priest')
  })

  it('first match wins: Priest beats Warrior', () => {
    const a = founder({
      nProducts: 1,
      customers: 1_000,
      activeSubscriptions: 700,
      retention: 0.7,
      mrrUsd: 5_000, // arpu = 5, which would also satisfy Warrior
    })
    expect(classFrom(a, 30)).toBe('Priest')
  })

  it('returns Rogue on few customers at a high ticket', () => {
    const a = founder({ nProducts: 1, customers: 10, mrrUsd: 5_000 })
    expect(classFrom(a, 30)).toBe('Rogue')
  })

  it('returns Warrior on volume at a low ticket', () => {
    const a = founder({ nProducts: 1, customers: 1_000, mrrUsd: 5_000 })
    expect(classFrom(a, 30)).toBe('Warrior')
  })

  it('requires domain rating for Hunter, otherwise falls further down', () => {
    const seo = founder({ nProducts: 1, channels: ['seo'], domainRating: 40 })
    expect(classFrom(seo, 20)).toBe('Hunter')

    const weak = founder({ nProducts: 1, channels: ['seo'], domainRating: 10 })
    expect(classFrom(weak, 20)).toBe('Adventurer')
  })

  it('returns Bard on a social channel', () => {
    expect(classFrom(founder({ nProducts: 1, channels: ['x-twitter'] }), 20)).toBe('Bard')
  })

  it('returns Mage on an AI stack', () => {
    expect(classFrom(founder({ nProducts: 1, stack: ['anthropic'] }), 20)).toBe('Mage')
  })

  it('falls back to Adventurer when the data says nothing, never anything else', () => {
    expect(classFrom(founder({ nProducts: 1 }), 20)).toBe('Adventurer')
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
    expect(itemLevelFor(0)).toBe(1)
    expect(itemLevelFor(1_000)).toBe(30)
    expect(itemLevelFor(10_000)).toBe(40)
  })
})
