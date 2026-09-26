import { describe, expect, it } from 'vitest'
import { storyCardPath } from './card-image'

describe('storyCardPath', () => {
  it('points at the png and stamps the two numbers that change', () => {
    expect(storyCardPath('levelsio', 60, 44)).toBe('/c/levelsio/poster/60-44')
  })

  it('stamps a missing item level rather than dropping the parameter', () => {
    expect(storyCardPath('levelsio', 12, null)).toBe('/c/levelsio/poster/12-na')
  })
})
