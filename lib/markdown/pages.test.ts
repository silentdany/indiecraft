import { describe, expect, it } from 'vitest'
import { characterMarkdown, homeMarkdown, ladderMarkdown, rulesMarkdown } from './pages'

const ladderRows = [
  {
    rank: 1,
    handle: 'levelsio',
    level: 60,
    ilvl: 251,
    characterClass: 'Evoker',
    nProducts: 7,
    realm: 'NL',
    faction: 'Horde',
  },
  {
    rank: 2,
    handle: 'marc',
    level: 58,
    ilvl: 190,
    characterClass: 'Rogue',
    nProducts: 3,
    realm: null,
    faction: null,
  },
]

describe('homeMarkdown', () => {
  const md = homeMarkdown({
    stats: {
      characters: 4237,
      maxLevel: 60,
      trackedMrrUsd: 1_200_000,
      products: 5100,
      achievements: 18_000,
    },
    top: ladderRows,
    factions: [{ value: 'Horde', count: 2100 }],
    classes: [{ name: 'Evoker', count: 900 }],
    realms: [{ value: 'US', count: 1100 }],
  })

  it('leads with the brand as the only H1', () => {
    expect(md.startsWith('# World of Indiecraft')).toBe(true)
    expect(md.match(/^# /gm)).toHaveLength(1)
  })

  it('states the realm figures an agent would otherwise have to count', () => {
    expect(md).toContain('4,237')
    expect(md).toContain('5,100')
  })

  it('renders the ladder as a table, ranked', () => {
    expect(md).toContain('| Rank | Founder | Level | iLvl | Class |')
    expect(md).toContain('| 1 | levelsio |')
  })

  it('links onward with absolute URLs', () => {
    expect(md).toContain('https://indiecraft.quest/ladder')
    expect(md).toContain('https://indiecraft.quest/rules')
    expect(md.match(/\]\(\/[^)]*\)/g)).toBeNull()
  })
})

describe('ladderMarkdown', () => {
  it('says how many founders the list is drawn from', () => {
    const md = ladderMarkdown({ rows: ladderRows, total: 4237, filterLabel: null })

    expect(md.startsWith('# The ladder')).toBe(true)
    expect(md).toContain('4,237')
    expect(md).toContain('| 2 | marc |')
  })

  it('names the filter when the list is a facet rather than the whole corpus', () => {
    const md = ladderMarkdown({ rows: ladderRows, total: 78, filterLabel: 'realm FR' })

    expect(md).toContain('realm FR')
  })

  it('leaves an unranked realm blank instead of inventing one', () => {
    const md = ladderMarkdown({ rows: ladderRows, total: 2, filterLabel: null })

    expect(md).not.toContain('null')
  })
})

describe('characterMarkdown', () => {
  const md = characterMarkdown({
    handle: 'levelsio',
    displayName: 'Pieter Levels',
    level: 60,
    ilvl: 251,
    characterClass: 'Evoker',
    rarity: { name: 'legendary', hex: '#ff8000' },
    xp: 3_000_000,
    nProducts: 7,
    mrrUsd: 150_000,
    revenueTotalUsd: 3_000_000,
    rank: 1,
    profile: { realm: 'NL', faction: 'Horde' },
    stats: {
      last30dUsd: 150_000,
      arpu: 30,
      growthMrr30d: 0.04,
      domainRating: 72,
      followers: 500_000,
      age: 12,
      customers: 5000,
      retention: null,
    },
    equipment: [
      {
        name: 'Nomad List',
        website: 'https://nomadlist.com',
        mrrUsd: 40_000,
        itemLevel: 240,
        rarity: { name: 'legendary', hex: '#ff8000' },
      },
    ],
    achievements: [{ code: 'first_blood', earnedOn: '2019-04-01' }],
    computedAt: '2026-08-24T02:00:00.000Z',
  })

  it('titles the sheet with the founder, not the site', () => {
    expect(md.startsWith('# Pieter Levels')).toBe(true)
    expect(md).toContain('levelsio')
  })

  it('carries the numbers the sheet is built on', () => {
    expect(md).toContain('60')
    expect(md).toContain('Evoker')
    expect(md).toContain('#1')
  })

  it('lists the equipment with its item level', () => {
    expect(md).toContain('Nomad List')
    expect(md).toContain('240')
  })

  it('names the achievement in words, not by code alone', () => {
    expect(md).toContain('First Blood')
  })

  it('says when the numbers were computed, since they move nightly', () => {
    expect(md).toContain('2026-08-24')
  })
})

describe('rulesMarkdown', () => {
  const md = rulesMarkdown()

  it('is the rules page, as prose an agent can read end to end', () => {
    expect(md.startsWith('# The rules')).toBe(true)
  })

  it('gives the level table its top and bottom rung', () => {
    expect(md).toContain('60')
    expect(md).toContain('$1')
  })

  it('lists every achievement the engine can award', () => {
    expect(md).toContain('First Blood')
    expect(md).toContain('The Thousand')
  })

  it('lists all seventeen equipment slots', () => {
    expect(md).toContain('Head')
    expect(md).toContain('Domain rating')
  })

  it('is markdown, never markup', () => {
    expect(md).not.toMatch(/<[a-z]+[ >]/)
  })
})
