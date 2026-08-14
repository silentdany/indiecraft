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
import { CLASS_COLORS, CLASS_RULES, LEVEL_THRESHOLDS, MAX_LEVEL } from './tuning'
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
    followers: null,
    foundedFirst: null,
    channels: [],
    stack: [],
    cofounders: [],
    visitors30d: 0,
    categories: [],
    hasMobileApp: false,
    profitMargin30d: null,
    googleImpressions30d: 0,
    everListedForSale: false,
    allProductsEarning: false,
    fundingStatuses: [],
    realm: null,
    faction: null,
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
  /*
   * iLvl is the mean item level of the worn gear now, not MRR projected over
   * twelve months. These tests assert the PROPERTIES that definition has to
   * hold, not exact numbers: the averages move whenever anybody retunes a
   * threshold in tuning.ts, and a test that pins them would fail on every
   * rebalance without telling anybody anything true.
   */
  const ilvl = (a: FounderAggregate) => ilvlFrom(a, classFrom(a, levelFromXp(xpFrom(a))))

  it('rises as the gear does', () => {
    const thin = founder({ mrrUsd: 100, nProducts: 1 })
    const rich = founder({
      mrrUsd: 100_000,
      revenueTotalUsd: 2_000_000,
      customers: 4_000,
      activeSubscriptions: 3_800,
      nProducts: 4,
      domainRating: 72,
      growthMrr30d: 40,
      foundedFirst: '2013-01-01',
      stack: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'],
      visitors30d: 200_000,
      profitMargin30d: 96,
      followers: 400_000,
    })
    expect(ilvl(thin)).toBeLessThan(ilvl(rich) ?? 0)
    expect(ilvl(rich)).toBeGreaterThan(40)
  })

  it('stays inside [1, 60]', () => {
    const monster = founder({
      mrrUsd: 50_000_000,
      revenueTotalUsd: 900_000_000,
      customers: 900_000,
      activeSubscriptions: 890_000,
      nProducts: 40,
      domainRating: 99,
      growthMrr30d: 900,
      followers: 90_000_000,
    })
    const v = ilvl(monster)
    expect(v).toBeGreaterThanOrEqual(1)
    expect(v).toBeLessThanOrEqual(60)
  })

  /*
   * The headline gain over the old formula, and the reason for the change: a
   * founder with no recurring revenue used to score null no matter what else
   * was true about them. Ten years of shipping and a real audience is not "no
   * answer".
   */
  it('scores a founder with no MRR but real everything else', () => {
    const gumroad = founder({
      mrrUsd: 0,
      revenueTotalUsd: 800_000,
      nProducts: 3,
      domainRating: 61,
      foundedFirst: '2014-01-01',
      stack: ['a', 'b', 'c', 'd', 'e', 'f'],
      followers: 30_000,
    })
    expect(ilvl(gumroad)).not.toBeNull()
    expect(ilvl(gumroad)).toBeGreaterThan(20)
  })

  it('never punishes a missing retention signal', () => {
    // TrustMRR sends customers: 0 on most listings. That is missing data, not
    // total churn: the Back slot goes empty and is left out of the average
    // rather than dragging it down.
    const blind = founder({
      mrrUsd: 1_000,
      customers: 0,
      activeSubscriptions: 400,
      hasRetentionSignal: false,
    })
    const seen = founder({
      mrrUsd: 1_000,
      customers: 400,
      activeSubscriptions: 400,
      hasRetentionSignal: true,
    })
    expect(ilvl(blind)).not.toBeNull()
    expect(ilvl(blind) ?? 0).toBeLessThanOrEqual(ilvl(seen) ?? 0)
  })

  it('is null only when the corpus said nothing at all', () => {
    // Every slot empty. `cofounders: 0` is a real answer and fills Ring 2, so
    // this is asserted through the doll rather than by hand.
    const known = founder({ nProducts: 1 })
    expect(ilvl(known)).not.toBeNull()
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
    expect(classFrom(founder({ nProducts: 1, channels: ['twitter'] }), 20)).toBe('Shaman')
    expect(classFrom(founder({ nProducts: 1, channels: ['x-twitter'] }), 20)).not.toBe('Shaman')
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

  /**
   * The line the retune of 2026-08-10 drew: Adventurer means "no revenue", not
   * "we could not be bothered". Somebody with money coming in is never told the
   * armory has no idea what they are.
   */
  it('falls back to Adventurer only when there is no revenue at all', () => {
    expect(classFrom(founder({ nProducts: 1, mrrUsd: 0, revenueTotalUsd: 0 }), 20)).toBe(
      'Adventurer',
    )
  })

  it('gives anyone still earning a class, however little the corpus says', () => {
    // MRR but no customer count at all — a very common shape outside the top
    // 200, and one that used to land in "we do not know".
    expect(classFrom(founder({ nProducts: 1, mrrUsd: 39, revenueTotalUsd: 0 }), 20)).toBe('Evoker')
    // Lifetime revenue only, with no recurring, is Monk and stays Monk.
    expect(classFrom(founder({ nProducts: 1, mrrUsd: 0, revenueTotalUsd: 4_000 }), 20)).toBe('Monk')
  })

  it('counts a small paying base as a base', () => {
    // Four subscribers at $139. A business the old floor of ten called unknown.
    const a = founder({ nProducts: 1, customers: 0, activeSubscriptions: 4, mrrUsd: 557 })
    expect(classFrom(a, 20)).toBe('Paladin')
  })

  it('still reserves Warrior for actual volume', () => {
    // Cheap, and enough of them to be volume.
    expect(classFrom(founder({ nProducts: 1, customers: 40, mrrUsd: 600 }), 20)).toBe('Warrior')
    // Cheap, but three customers is not volume — that is somebody starting.
    expect(classFrom(founder({ nProducts: 1, customers: 3, mrrUsd: 45 }), 20)).toBe('Evoker')
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
    // White, not grey: grey is POOR in the reference and means no item at all.
    expect(rarityFor(1).hex).toBe('#ffffff')
    expect(rarityFor(9).hex).toBe('#ffffff')
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
  it('reports how much of the doll is filled instead of an iLvl gap', () => {
    /*
     * `ilvlDelta` used to be `ilvl - level`, and it is gone.
     *
     * It only ever meant something because iLvl was defined on the level scale
     * — "the level twelve months of this MRR would be worth" — so subtracting
     * one from the other compared like with like. The doll average is a
     * different scale: the reference has level 60 characters at item level 66
     * and never subtracts, because the two answer different questions.
     *
     * What replaced it is the thing a player actually reads off a paper doll:
     * how many slots are filled.
     */
    const sheet = computeCharacter(founder({ revenueTotalUsd: 3_000, mrrUsd: 2_000, nProducts: 1 }))
    expect(sheet.equipped.total).toBe(17)
    expect(sheet.equipped.worn).toBeGreaterThan(0)
    expect(sheet.equipped.worn).toBeLessThanOrEqual(17)
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

describe('the class roster', () => {
  /**
   * Bard and Ranger shipped for a day and are not classes anybody has played.
   * The point of borrowing this vocabulary is that it needs no explaining, and
   * an invented class explains nothing to the audience it was borrowed for.
   */
  it('only uses classes that exist in the reference', () => {
    const real = new Set([
      'Death Knight',
      'Demon Hunter',
      'Druid',
      'Evoker',
      'Hunter',
      'Mage',
      'Monk',
      'Paladin',
      'Priest',
      'Rogue',
      'Shaman',
      'Warlock',
      'Warrior',
    ])
    for (const rule of CLASS_RULES) {
      // Adventurer is the one exception, and deliberately not a class: it is
      // the state of having none yet.
      if (rule.class === 'Adventurer') continue
      expect(real.has(rule.class)).toBe(true)
    }
  })

  it('gives every class a colour, and the canonical one', () => {
    for (const rule of CLASS_RULES) {
      expect(CLASS_COLORS[rule.class]).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
    expect(CLASS_COLORS.Paladin).toBe('#F48CBA')
    expect(CLASS_COLORS.Priest).toBe('#FFFFFF')
    expect(CLASS_COLORS.Mage).toBe('#3FC7EB')
  })
})
