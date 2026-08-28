import { describe, expect, it } from 'vitest'
import { planQueue } from './crawl-plan'

/** `n` slugs named so the order they came back in stays readable in a failure. */
const slugs = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix}-${String(i).padStart(4, '0')}`)

/**
 * The shape of the night that broke on 2026-08-20.
 *
 * TrustMRR lifted the 200-item cap on its list endpoint and started returning
 * ~5,000. Nothing in this repo changed. Every run since was killed at the
 * workflow's three-hour ceiling, having collected the first 575 of a 4,999-slug
 * queue and never reached the compute step.
 */
const theNightItBroke = () => {
  const ranked = slugs('ranked', 5000)
  return {
    ranked,
    owed: ['mine-a', 'mine-b'],
    discovered: [...ranked, ...slugs('tail', 4000)],
    lastSeen: new Map<string, string>(),
    budget: 800,
    ladder: 200,
  }
}

describe('planQueue', () => {
  it('keeps the queue inside the budget when the ranked list outgrows it', () => {
    expect(planQueue(theNightItBroke()).slugs).toHaveLength(800)
  })

  it("collects a claimed founder's products before anything else", () => {
    expect(planQueue(theNightItBroke()).slugs.slice(0, 2)).toEqual(['mine-a', 'mine-b'])
  })

  it('still rotates never-collected slugs when the ranked list fills the budget', () => {
    const plan = planQueue(theNightItBroke())
    expect(plan.rotating.length).toBeGreaterThan(0)
    expect(plan.fresh).toBe(plan.rotating.length)
  })

  it('refreshes the whole ladder every night', () => {
    const plan = planQueue(theNightItBroke())
    expect(plan.ladder).toEqual(slugs('ranked', 200))
  })

  it('takes the never-collected before the least recently seen', () => {
    const plan = planQueue({
      ranked: [],
      owed: [],
      discovered: ['stale', 'never', 'fresh'],
      lastSeen: new Map([
        ['stale', '2026-01-01'],
        ['fresh', '2026-08-27'],
      ]),
      budget: 3,
      ladder: 200,
    })
    expect(plan.rotating).toEqual(['never', 'stale', 'fresh'])
  })

  it('never queues the same slug twice', () => {
    const plan = planQueue({
      ...theNightItBroke(),
      owed: ['ranked-0000', 'mine-a'],
    })
    expect(new Set(plan.slugs).size).toBe(plan.slugs.length)
  })

  it('leaves a small corpus exactly as it was', () => {
    const plan = planQueue({
      ranked: slugs('ranked', 200),
      owed: [],
      discovered: [...slugs('ranked', 200), ...slugs('tail', 4000)],
      lastSeen: new Map(),
      budget: 800,
      ladder: 200,
    })
    expect(plan.slugs).toHaveLength(800)
    expect(plan.rotating).toHaveLength(600)
  })
})
