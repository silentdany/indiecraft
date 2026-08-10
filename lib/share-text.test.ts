import { describe, expect, it } from 'vitest'
import { type ShareFacts, sharePosts } from './share-text'

function facts(overrides: Partial<ShareFacts> = {}): ShareFacts {
  return {
    level: 30,
    ilvl: 28,
    characterClass: 'Paladin',
    rank: 70,
    total: 142,
    classRank: 9,
    classTotal: 18,
    realm: null,
    achievements: 3,
    achievementsTotal: 15,
    recentLevelUp: null,
    recentAchievement: null,
    growthMrr30d: null,
    mrrUsd: 1200,
    ...overrides,
  }
}

const keys = (f: Partial<ShareFacts> = {}) => sharePosts(facts(f)).map((p) => p.key)
const texts = (f: Partial<ShareFacts> = {}) => sharePosts(facts(f)).map((p) => p.text)

describe('share posts', () => {
  it('always offers at least one, even with nothing to boast about', () => {
    const posts = sharePosts(facts({ rank: 142, classRank: 18, level: 3, achievements: 0 }))
    expect(posts.length).toBeGreaterThan(0)
    expect(posts.at(-1)?.key).toBe('joke')
  })

  /**
   * The rule the whole file exists to hold. Nobody is ever handed a sentence
   * that advertises being near the bottom.
   */
  it('never offers a rank to somebody who is not near the top', () => {
    for (const text of texts({ rank: 122, total: 142, classRank: 15, classTotal: 18 })) {
      expect(text).not.toContain('#122')
      expect(text).not.toContain('122')
      expect(text).not.toContain('15th')
    }
  })

  it('leads with a level-up, because an event is the reason to post twice', () => {
    expect(keys({ recentLevelUp: 57, rank: 4 })[0]).toBe('levelup')
  })

  it('puts a fresh achievement above a standing', () => {
    const k = keys({ recentAchievement: 'Raid Boss Slayer', rank: 4 })
    expect(k.indexOf('achievement')).toBeLessThan(k.indexOf('top10'))
  })

  it('offers the exact rank only inside the top ten', () => {
    expect(texts({ rank: 7 }).some((t) => t.includes('#7'))).toBe(true)
    expect(keys({ rank: 11, total: 142 })).toContain('topten')
    expect(texts({ rank: 11, total: 142 }).some((t) => t.includes('#11'))).toBe(false)
  })

  /**
   * A generous floor on this threshold made the claim false on a small ladder:
   * rank 20 of 25 is not the top tenth of anything. The one thing a sentence
   * somebody signs their name to may not be is untrue.
   */
  it('never claims a top 10% that is not one', () => {
    expect(keys({ rank: 20, total: 25 })).not.toContain('topten')
    expect(keys({ rank: 3, total: 25 })).toContain('top10')
    expect(keys({ rank: 14, total: 140 })).toContain('topten')
    expect(keys({ rank: 15, total: 140 })).not.toContain('topten')
  })

  it('capitalises the class, matching the card printed beside the text', () => {
    expect(texts({ level: 56 }).some((t) => t.includes('Paladin'))).toBe(true)
    expect(texts({ level: 56 }).some((t) => t.includes('paladin'))).toBe(false)
  })

  it('offers a realm standing only in its top three', () => {
    expect(keys({ realm: { name: 'France', rank: 2, total: 14 } })).toContain('realm')
    expect(keys({ realm: { name: 'France', rank: 9, total: 14 } })).not.toContain('realm')
  })

  it('does not call a realm of two a podium', () => {
    expect(keys({ realm: { name: 'Italy', rank: 1, total: 2 } })).not.toContain('realm')
  })

  it('skips a class standing when the class is too small to mean anything', () => {
    expect(keys({ classRank: 1, classTotal: 3 })).not.toContain('class')
    expect(keys({ classRank: 1, classTotal: 18 })).toContain('class')
  })

  it('only mentions growth when it is worth mentioning', () => {
    expect(keys({ growthMrr30d: 0.4 })).not.toContain('growth')
    expect(keys({ growthMrr30d: -12 })).not.toContain('growth')
    expect(keys({ growthMrr30d: 34 })).toContain('growth')
  })

  it('calls a business with no recurring revenue a side project, not a SaaS', () => {
    expect(texts({ mrrUsd: 0 }).at(-1)).toContain('side project')
    expect(texts({ mrrUsd: 900 }).at(-1)).toContain('SaaS')
  })

  it('never puts a URL in the text — X appends its own', () => {
    for (const text of texts({
      rank: 2,
      recentLevelUp: 60,
      realm: { name: 'Poland', rank: 1, total: 6 },
    })) {
      expect(text).not.toMatch(/https?:\/\//)
    }
  })

  it('stays inside a comfortable post length once a link is appended', () => {
    for (const text of texts({ rank: 1, recentLevelUp: 60, recentAchievement: 'The Thousand' })) {
      expect(text.length).toBeLessThanOrEqual(200)
    }
  })

  it('produces no duplicate keys, so cycling never repeats itself', () => {
    const k = keys({ rank: 2, recentLevelUp: 60, realm: { name: 'France', rank: 1, total: 14 } })
    expect(new Set(k).size).toBe(k.length)
  })
})
