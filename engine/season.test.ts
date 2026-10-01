import { describe, expect, it } from 'vitest'
import { computeCharacter, xpFrom } from './character'
import {
  seasonBoard,
  seasonScore,
  seasonStanding,
  seasonWindowBefore,
  seasonWindowById,
  seasonWindowOn,
} from './season'
import type { FounderAggregate, SeasonFounder, SeasonWindow } from './types'

const PREVIOUS: SeasonWindow = { id: '2026-01-01', startsOn: '2026-01-01', endsOn: '2026-04-01' }
const CURRENT: SeasonWindow = { id: '2026-04-01', startsOn: '2026-04-01', endsOn: '2026-06-30' }

function peer(over: Partial<SeasonFounder> & Pick<SeasonFounder, 'handle'>): SeasonFounder {
  return {
    realm: 'FR',
    revenueTotalUsd: 0,
    level: 10,
    characterClass: 'Mage',
    samples: [],
    ...over,
  }
}

function sheet(over: Partial<FounderAggregate> = {}): FounderAggregate {
  return {
    handle: 'someone',
    revenueTotalUsd: 1_000,
    mrrUsd: 10,
    last30dUsd: 10,
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
    realm: 'FR',
    faction: null,
    ...over,
  }
}

describe('season windows', () => {
  it('opens on the epoch and closes ninety days later', () => {
    expect(seasonWindowOn('2026-01-01')).toEqual(PREVIOUS)
    expect(seasonWindowOn('2026-03-31')).toEqual(PREVIOUS)
    expect(seasonWindowOn('2026-04-01')).toEqual(CURRENT)
    expect(seasonWindowBefore(CURRENT)).toEqual(PREVIOUS)
  })

  it("accepts a season id only when it is that season's start", () => {
    expect(seasonWindowById('2026-01-01')).toEqual(PREVIOUS)
    expect(seasonWindowById('2026-02-15')).toBeNull()
    expect(seasonWindowById('current')).toBeNull()
  })
})

describe('seasonBoard', () => {
  const founders: SeasonFounder[] = [
    peer({
      handle: 'rich',
      revenueTotalUsd: 1_000_000,
      samples: [
        { day: '2026-02-01', recentUsd: 9_000 },
        { day: '2026-05-01', recentUsd: 100 },
      ],
    }),
    peer({
      handle: 'hot',
      revenueTotalUsd: 1_000,
      samples: [
        { day: '2026-02-01', recentUsd: 50 },
        { day: '2026-05-01', recentUsd: 5_000 },
      ],
    }),
    peer({
      handle: 'abroad',
      realm: 'DE',
      revenueTotalUsd: 50_000,
      samples: [{ day: '2026-05-01', recentUsd: 80_000 }],
    }),
    peer({
      handle: 'nowhere',
      realm: null,
      revenueTotalUsd: 50_000,
      samples: [{ day: '2026-05-01', recentUsd: 80_000 }],
    }),
  ]

  it('ranks the higher recent performer above the higher lifetime earner, inside one realm', () => {
    const board = seasonBoard(founders, CURRENT, 'FR')
    expect(board.rows.map((row) => row.handle)).toEqual(['hot', 'rich'])
    expect(board.rows[0]?.scoreUsd).toBe(5_000)
    expect(board.rows[1]?.revenueTotalUsd).toBeGreaterThan(board.rows[0]!.revenueTotalUsd)
    expect(board.rows.some((row) => row.handle === 'abroad')).toBe(false)
    expect(board.rows.some((row) => row.handle === 'nowhere')).toBe(false)
  })

  it('keeps the finished season, and ignores it once the next one has started', () => {
    const finished = seasonBoard(founders, PREVIOUS, 'FR')
    const next = seasonBoard(founders, CURRENT, 'FR')
    expect(finished.rows.map((row) => row.handle)).toEqual(['rich', 'hot'])
    expect(finished.rows[0]?.scoreUsd).toBe(9_000)
    expect(next.rows.map((row) => row.handle)).toEqual(['hot', 'rich'])
    expect(seasonScore(founders[0]!.samples, CURRENT)).toBe(100)
    expect(seasonScore(founders[0]!.samples, CURRENT)).not.toBe(9_000)
  })

  it('leaves a founder with no realm off every board', () => {
    expect(seasonStanding(founders, CURRENT, 'nowhere')).toBeNull()
    expect(seasonStanding(founders, CURRENT, 'hot')).toMatchObject({
      realm: 'FR',
      rank: 1,
      total: 2,
      scoreUsd: 5_000,
    })
    expect(seasonStanding(founders, CURRENT, 'rich')).toMatchObject({
      rank: 2,
      aboveHandle: 'hot',
      aboveScoreUsd: 5_000,
    })
  })

  it('breaks a tie on the handle, not on lifetime revenue', () => {
    const tied = [
      peer({
        handle: 'zeta',
        revenueTotalUsd: 9_000_000,
        samples: [{ day: '2026-05-01', recentUsd: 10 }],
      }),
      peer({
        handle: 'alpha',
        revenueTotalUsd: 1,
        samples: [{ day: '2026-05-01', recentUsd: 10 }],
      }),
    ]
    expect(seasonBoard(tied, CURRENT, 'FR').rows.map((row) => row.handle)).toEqual([
      'alpha',
      'zeta',
    ])
  })

  it('does not change XP, level, class, or item level', () => {
    const aggregate = sheet()
    const before = computeCharacter(aggregate)
    seasonBoard(founders, CURRENT, 'FR')
    seasonStanding(founders, PREVIOUS, 'rich')
    const after = computeCharacter(aggregate)
    expect(after.xp).toBe(before.xp)
    expect(after.xp).toBe(xpFrom(aggregate))
    expect(after.level).toBe(before.level)
    expect(after.class).toBe(before.class)
    expect(after.ilvl).toBe(before.ilvl)
  })
})
