import { describe, expect, it } from 'vitest'
import { computeCharacter, levelFromXp, xpFrom } from './character'
import { instancesFor } from './instances'
import { seasonBoard } from './season'
import { INSTANCES } from './tuning'
import type { FounderAggregate, SeasonFounder } from './types'

function founder(over: Partial<FounderAggregate> = {}): FounderAggregate {
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

/** Stats that meet every boss, at a lifetime revenue the caller chooses. */
function geared(revenueTotalUsd: number): FounderAggregate {
  return founder({
    revenueTotalUsd,
    nProducts: 1,
    mrrUsd: 100_000,
    last30dUsd: 100_000,
    domainRating: 80,
    followers: 300_000,
    activeSubscriptions: 5_000,
    customers: 5_000,
    effectiveCustomers: 5_000,
    visitors30d: 50_000,
    hasRetentionSignal: true,
    retention: 1,
  })
}

describe('instances', () => {
  it('spreads dungeons up the climb and puts one stricter raid above them', () => {
    const dungeons = INSTANCES.filter((wing) => wing.kind === 'dungeon')
    const raids = INSTANCES.filter((wing) => wing.kind === 'raid')
    expect(dungeons.length).toBeGreaterThanOrEqual(2)
    expect(raids.length).toBeGreaterThanOrEqual(1)
    expect(dungeons.some((wing) => wing.requiredLevel < 30)).toBe(true)
    expect(dungeons.some((wing) => wing.requiredLevel >= 30)).toBe(true)
    const highestDungeon = Math.max(...dungeons.map((wing) => wing.requiredLevel))
    const widestDungeon = Math.max(...dungeons.map((wing) => wing.bosses.length))
    for (const raid of raids) {
      expect(raid.requiredLevel).toBeGreaterThan(highestDungeon)
      expect(raid.bosses.length).toBeGreaterThan(widestDungeon)
    }
    for (const wing of INSTANCES) {
      expect(wing.bosses.length).toBeGreaterThanOrEqual(2)
      expect(wing.difficulty).toBe('normal')
      expect('size' in wing).toBe(false)
    }
    expect(new Set(INSTANCES.map((wing) => wing.difficulty)).size).toBe(1)
  })

  it('keeps names in the sheet voice', () => {
    const banned = /skyborne|barrow|hyjal|onyxia|naxx|fail|joke|lol|trash|suck/i
    for (const wing of INSTANCES) {
      expect(wing.name.length).toBeGreaterThan(0)
      expect(wing.blurb.length).toBeGreaterThan(0)
      expect(`${wing.name} ${wing.blurb}`).not.toMatch(banned)
      for (const boss of wing.bosses) {
        expect(`${boss.name} ${boss.blurb} ${boss.requirement}`).not.toMatch(banned)
      }
    }
  })

  it('gives a low sheet an open dungeon and no cleared raid', () => {
    // $600 plus the per-product grant is level 20. The first wing opens at 18.
    const aggregate = founder({ revenueTotalUsd: 600, nProducts: 1 })
    const level = levelFromXp(xpFrom(aggregate))
    expect(level).toBe(20)
    const wings = instancesFor(aggregate, level)
    const dungeon = wings.find((wing) => wing.code === 'venture-deeps')
    const raid = wings.find((wing) => wing.kind === 'raid')
    expect(dungeon?.locked).toBe(false)
    expect(dungeon?.cleared).toBe(false)
    expect(raid?.cleared).toBe(false)
    expect(raid?.locked).toBe(true)
  })

  it('clears a wing only when every boss is down, in listed order', () => {
    const aggregate = founder({ revenueTotalUsd: 100_000, nProducts: 1, mrrUsd: 20, last30dUsd: 0 })
    const level = levelFromXp(xpFrom(aggregate))
    const wing = instancesFor(aggregate, level).find((entry) => entry.code === 'venture-deeps')
    expect(wing?.bosses.map((boss) => boss.code)).toEqual(['first-invoice', 'open-book'])
    expect(wing?.bosses[0]?.down).toBe(true)
    expect(wing?.bosses[1]?.down).toBe(false)
    expect(wing?.cleared).toBe(false)
  })

  it('lets a mid sheet clear a dungeon while the raid stays locked', () => {
    // $100k is level 40: past the first wing, short of the raid at 58.
    const aggregate = founder({
      revenueTotalUsd: 100_000,
      nProducts: 1,
      mrrUsd: 20,
      last30dUsd: 20,
    })
    const level = levelFromXp(xpFrom(aggregate))
    expect(level).toBe(40)
    const wings = instancesFor(aggregate, level)
    expect(wings.find((wing) => wing.code === 'venture-deeps')?.cleared).toBe(true)
    const raid = wings.find((wing) => wing.kind === 'raid')
    expect(raid?.locked).toBe(true)
    expect(raid?.cleared).toBe(false)
  })

  it('refuses a raid clear to a founder under its level, even when every boss is down', () => {
    const aggregate = geared(100_000)
    const level = levelFromXp(xpFrom(aggregate))
    expect(level).toBeLessThan(58)
    const raid = instancesFor(aggregate, level).find((wing) => wing.kind === 'raid')
    expect(raid?.bosses.every((boss) => boss.down)).toBe(true)
    expect(raid?.locked).toBe(true)
    expect(raid?.cleared).toBe(false)
  })

  it('clears a dungeon and the raid for a sheet that has earned both', () => {
    const aggregate = geared(6_300_000)
    const level = levelFromXp(xpFrom(aggregate))
    expect(level).toBe(58)
    const wings = instancesFor(aggregate, level)
    expect(wings.find((wing) => wing.code === 'venture-deeps')?.cleared).toBe(true)
    const raid = wings.find((wing) => wing.kind === 'raid')
    expect(raid?.locked).toBe(false)
    expect(raid?.cleared).toBe(true)
  })

  it('does not change XP, level, class, or item level', () => {
    const aggregate = geared(6_300_000)
    const before = computeCharacter(aggregate)
    instancesFor(aggregate, before.level)
    const peers: SeasonFounder[] = [
      {
        handle: aggregate.handle,
        realm: 'FR',
        revenueTotalUsd: aggregate.revenueTotalUsd,
        level: before.level,
        characterClass: before.class,
        samples: [{ day: '2026-05-01', recentUsd: 10 }],
      },
    ]
    seasonBoard(peers, { id: '2026-04-01', startsOn: '2026-04-01', endsOn: '2026-07-01' }, 'FR')
    const after = computeCharacter(aggregate)
    expect(before.xp).toBe(xpFrom(aggregate))
    expect(after.xp).toBe(before.xp)
    expect(after.level).toBe(before.level)
    expect(after.class).toBe(before.class)
    expect(after.ilvl).toBe(before.ilvl)
    expect(before.ilvl).not.toBeNull()
  })
})
