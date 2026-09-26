import { describe, expect, it } from 'vitest'
import { posterLine } from './poster-copy'

describe('posterLine', () => {
  it('uses the level-up while it is still news', () => {
    expect(posterLine({ level: 24, characterClass: 'Mage', mrrUsd: 0, recentLevelUp: 24 })).toBe(
      'DING! Level 24.',
    )
  })

  it('does not call a one-off sale a SaaS', () => {
    expect(posterLine({ level: 24, characterClass: 'Mage', mrrUsd: 0, recentLevelUp: null })).toBe(
      'Apparently my side project makes me a level 24 Mage.',
    )
  })

  it('says SaaS only when there is monthly revenue', () => {
    expect(
      posterLine({ level: 40, characterClass: 'Paladin', mrrUsd: 1200, recentLevelUp: null }),
    ).toBe('Apparently my SaaS makes me a level 40 Paladin.')
  })
})
