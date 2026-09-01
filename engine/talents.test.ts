import { describe, expect, it } from 'vitest'
import { classFrom } from './character'
import { pointsFor, talentsFor } from './talents'
import { CLASS_RULES, MAX_LEVEL, TALENT_TREES, TALENT_TREES_BY_CLASS } from './tuning'
import type { CharacterClass, FounderAggregate } from './types'

/**
 * Mirrors what aggregateFounder derives, exactly as character.test.ts does, so
 * a test that sets `customers` gets a coherent aggregate rather than a
 * hand-assembled impossible one.
 */
function founder(overrides: Partial<FounderAggregate> = {}): FounderAggregate {
  const base: FounderAggregate = {
    handle: 'test',
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

describe('points available', () => {
  it('grants nothing before level 10', () => {
    expect(pointsFor(1)).toBe(0)
    expect(pointsFor(9)).toBe(0)
  })

  it('grants the first point at 10 and the fifty-first at 60', () => {
    expect(pointsFor(10)).toBe(1)
    expect(pointsFor(11)).toBe(2)
    expect(pointsFor(MAX_LEVEL)).toBe(51)
  })

  it('never goes negative or past the cap, whatever it is handed', () => {
    expect(pointsFor(-40)).toBe(0)
    expect(pointsFor(Number.NaN)).toBe(0)
    // A level above the cap is a database column that disagrees with the level
    // table. It gets 51, not 91.
    expect(pointsFor(100)).toBe(51)
  })
})

describe('no build', () => {
  it('gives a level 9 founder no tree and nothing to print', () => {
    const build = talentsFor(founder({ stack: ['openai'] }), 'Mage', 9)
    expect(build.points).toBe(0)
    expect(build.spec).toBeNull()
    expect(build.specKey).toBeNull()
    expect(build.trees).toHaveLength(0)
    expect(build.label).toBe('')
  })

  /**
   * Adventurer is the state of having no class yet, so there is nothing to
   * specialise in — not even at 60. Inventing three trees for somebody whose
   * whole description is not having picked a direction would be the talent
   * version of the retention penalty this engine has thrown out twice.
   */
  it('gives Adventurer no build at any level', () => {
    const build = talentsFor(founder({ nProducts: 0 }), 'Adventurer', MAX_LEVEL)
    expect(build.spec).toBeNull()
    expect(build.label).toBe('')
    expect(build.trees).toHaveLength(0)
    expect(build.points).toBe(0)
  })
})

describe('allocation', () => {
  const mage = (over: Partial<FounderAggregate> = {}) =>
    talentsFor(founder({ stack: ['openai'], mrrUsd: 5_000, ...over }), 'Mage', MAX_LEVEL)

  it('spends every point, and only the points available', () => {
    for (const level of [10, 23, 41, MAX_LEVEL]) {
      const build = talentsFor(
        founder({ stack: ['openai'], mrrUsd: 5_000, growthMrr30d: 40 }),
        'Mage',
        level,
      )
      const spent = build.trees.reduce((sum, t) => sum + t.points, 0)
      expect(build.points).toBe(pointsFor(level))
      expect(spent).toBe(build.points)
    }
  })

  it('always returns exactly three trees, in table order', () => {
    const build = mage()
    expect(build.trees.map((t) => t.key)).toEqual(['mage-arcane', 'mage-fire', 'mage-frost'])
  })

  /**
   * The doctrine the whole engine turns on, in its talent form.
   *
   * A tree whose stat TrustMRR never reported takes no points. It must not take
   * zero points *by rounding* either — it has to be excluded from the split, so
   * the trees that do have a signal receive the full 51 between them.
   */
  it('does not let a missing signal take points from a tree that has one', () => {
    // Three paid channels and seven products, and no customer count at all, so
    // Destruction has no ARPU to read.
    const build = talentsFor(
      founder({
        channels: ['google-ads', 'meta-ads', 'facebook'],
        nProducts: 7,
        mrrUsd: 4_000,
        customers: 0,
        activeSubscriptions: 0,
      }),
      'Warlock',
      MAX_LEVEL,
    )
    const [affliction, demonology, destruction] = build.trees
    expect(destruction?.weight).toBe(0)
    expect(destruction?.points).toBe(0)
    expect((affliction?.points ?? 0) + (demonology?.points ?? 0)).toBe(51)
  })

  /**
   * Two trees at identical strength split the points and the odd one goes to
   * whichever is listed first — the same tiebreak CLASS_RULES uses for a first
   * match, and the reason table order is written down in tuning.ts.
   */
  it('breaks a tie on table order, for the point and for the spec', () => {
    const build = talentsFor(
      founder({
        channels: ['google-ads', 'meta-ads', 'facebook'],
        nProducts: 7,
        mrrUsd: 4_000,
      }),
      'Warlock',
      MAX_LEVEL,
    )
    expect(build.trees[0]?.weight).toBe(build.trees[1]?.weight)
    expect(build.trees[0]?.points).toBe(26)
    expect(build.trees[1]?.points).toBe(25)
    expect(build.spec).toBe('Affliction')
  })

  /**
   * TALENTS.contrast sharpens the split, and it is raised to a power — a
   * monotone transform, so it may change how far apart two trees land and must
   * never change which of them is ahead. A stronger signal receiving fewer
   * points would be the ordering silently inverting, which no reader could
   * catch from the sheet.
   */
  it('never gives a weaker signal more points than a stronger one', () => {
    const build = talentsFor(
      founder({
        domainRating: 68,
        followers: 12_000,
        last30dUsd: 31_000,
        channels: ['seo'],
        mrrUsd: 30_000,
      }),
      'Hunter',
      MAX_LEVEL,
    )
    for (const a of build.trees) {
      for (const b of build.trees) {
        if (a.weight > b.weight) expect(a.points).toBeGreaterThanOrEqual(b.points)
      }
    }
  })

  it('puts everything in the first tree when no signal answers at all', () => {
    // Not reachable through a real Mage — the class rule matched on the stack
    // this tree reads — but the allocator has to have an answer rather than
    // dividing by zero.
    const build = talentsFor(founder({ stack: [], mrrUsd: 0 }), 'Mage', MAX_LEVEL)
    expect(build.trees.map((t) => t.points)).toEqual([51, 0, 0])
    expect(build.spec).toBe('Arcane')
  })
})

describe('the spec', () => {
  /**
   * The entire point of the feature: same class, same level, different
   * businesses, different sheets. Two Mages who would otherwise print one word
   * between them.
   */
  it('separates two founders of the same class', () => {
    const burning = talentsFor(
      founder({ stack: ['openai'], mrrUsd: 5_000, growthMrr30d: 200 }),
      'Mage',
      MAX_LEVEL,
    )
    const holding = talentsFor(
      founder({
        stack: ['openai'],
        mrrUsd: 5_000,
        growthMrr30d: 0,
        customers: 100,
        activeSubscriptions: 92,
        retention: 0.92,
      }),
      'Mage',
      MAX_LEVEL,
    )
    expect(burning.spec).toBe('Fire')
    expect(holding.spec).toBe('Frost')
    expect(burning.label).not.toBe(holding.label)
  })

  it('names the deepest tree', () => {
    const build = talentsFor(
      founder({ stack: ['openai'], mrrUsd: 5_000, growthMrr30d: 200 }),
      'Mage',
      MAX_LEVEL,
    )
    const deepest = [...build.trees].sort((a, b) => b.points - a.points)[0]
    expect(build.spec).toBe(deepest?.name)
    expect(build.specKey).toBe(deepest?.key)
  })

  it('prints the label as the spec and three totals in table order', () => {
    const build = talentsFor(
      founder({ stack: ['openai'], mrrUsd: 5_000, growthMrr30d: 200 }),
      'Mage',
      MAX_LEVEL,
    )
    const [a, b, c] = build.trees.map((t) => t.points)
    expect(build.label).toBe(`${build.spec} ${a}/${b}/${c}`)
    expect(build.label).toMatch(/^[A-Z][a-zA-Z ]* \d+\/\d+\/\d+$/)
  })
})

/**
 * One representative founder per class, matched through the real class tree
 * rather than asserted by hand, so a rebalance of CLASS_RULES that breaks a
 * fixture fails here rather than in production.
 */
const REPRESENTATIVE: readonly { class: CharacterClass; aggregate: FounderAggregate }[] = [
  { class: 'Mage', aggregate: founder({ stack: ['openai'] }) },
  { class: 'Hunter', aggregate: founder({ domainRating: 60 }) },
  { class: 'Warlock', aggregate: founder({ channels: ['google-ads'] }) },
  { class: 'Shaman', aggregate: founder({ channels: ['twitter'] }) },
  {
    class: 'Priest',
    aggregate: founder({ customers: 100, activeSubscriptions: 92, retention: 0.92 }),
  },
  { class: 'Monk', aggregate: founder({ revenueTotalUsd: 5_000, mrrUsd: 0 }) },
  { class: 'Rogue', aggregate: founder({ customers: 10, mrrUsd: 5_000 }) },
  { class: 'Warrior', aggregate: founder({ customers: 40, mrrUsd: 600 }) },
  { class: 'Paladin', aggregate: founder({ customers: 200, mrrUsd: 10_000 }) },
  { class: 'Evoker', aggregate: founder({ mrrUsd: 39 }) },
]

describe('the class roster', () => {
  it('gives every class but Adventurer exactly three trees', () => {
    const playable = new Set(CLASS_RULES.map((r) => r.class).filter((c) => c !== 'Adventurer'))
    for (const cls of playable) {
      const def = TALENT_TREES_BY_CLASS.get(cls)
      expect(def, `${cls} has no talent trees`).toBeDefined()
      expect(def?.trees).toHaveLength(3)
    }
    expect(TALENT_TREES_BY_CLASS.has('Adventurer')).toBe(false)
  })

  it('keeps every tree key unique across the whole table', () => {
    const keys = TALENT_TREES.flatMap((c) => c.trees.map((t) => t.key))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('gives every tree a name, an icon and a screenshot-safe blurb', () => {
    for (const cls of TALENT_TREES) {
      for (const tree of cls.trees) {
        expect(tree.name.length).toBeGreaterThan(0)
        expect(tree.icon).toMatch(/^[a-z0-9_]+$/)
        expect(tree.blurb.length).toBeGreaterThan(0)
        // A tunable ceiling of zero would make every founder's tree full.
        expect(tree.full).toBeGreaterThan(0)
      }
    }
  })

  /**
   * The property the whole signal table is built around: every class has at
   * least one tree its own CLASS_RULE guarantees is alive, so the
   * all-signals-dead fallback is unreachable for anybody who actually holds the
   * class. A rebalance that swaps a signal for one the class rule does not
   * imply fails here.
   */
  it('leaves no class where a real member could have three dead trees', () => {
    for (const { class: cls, aggregate } of REPRESENTATIVE) {
      expect(classFrom(aggregate, 30), `fixture for ${cls} no longer matches its rule`).toBe(cls)
      const build = talentsFor(aggregate, cls, 30)
      const alive = build.trees.filter((t) => t.weight > 0)
      expect(alive.length, `${cls} has no live tree on a minimal member`).toBeGreaterThan(0)
      expect(build.trees.reduce((sum, t) => sum + t.points, 0)).toBe(build.points)
    }
  })

  it('covers every class the tree can return', () => {
    const covered = new Set(REPRESENTATIVE.map((r) => r.class))
    for (const rule of CLASS_RULES) {
      if (rule.class === 'Adventurer') continue
      expect(covered.has(rule.class), `no representative founder for ${rule.class}`).toBe(true)
    }
  })
})
