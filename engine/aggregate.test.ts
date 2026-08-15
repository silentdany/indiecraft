import { describe, expect, it } from 'vitest'
import { aggregateFounder } from './aggregate'
import type { ProductInput } from './types'

function product(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    slug: 'p',
    name: 'P',
    iconUrl: null,
    revenueTotalUsd: 0,
    mrrUsd: 0,
    last30dUsd: 0,
    customers: 0,
    activeSubscriptions: 0,
    growthMrr30d: null,
    domainRating: null,
    followers: null,
    visitors30d: null,
    revenuePerVisitor: null,
    foundedDate: null,
    fundingStatus: null,
    channels: [],
    stack: [],
    cofounders: [],
    country: null,
    businessType: null,
    category: null,
    isMobileApp: false,
    profitMargin30d: null,
    googleImpressions30d: null,
    listedForSaleAt: null,
    ...overrides,
  }
}

describe('founder aggregation', () => {
  it('sums metrics across every startup', () => {
    const a = aggregateFounder('marc', [
      product({
        slug: 'a',
        revenueTotalUsd: 1_000,
        mrrUsd: 100,
        customers: 30,
        activeSubscriptions: 20,
      }),
      product({
        slug: 'b',
        revenueTotalUsd: 500,
        mrrUsd: 50,
        customers: 10,
        activeSubscriptions: 5,
      }),
    ])
    expect(a.revenueTotalUsd).toBe(1_500)
    expect(a.mrrUsd).toBe(150)
    expect(a.customers).toBe(40)
    expect(a.activeSubscriptions).toBe(25)
    expect(a.nProducts).toBe(2)
    expect(a.retention).toBeCloseTo(0.625)
  })

  it('does not divide by zero when there are no customers', () => {
    expect(aggregateFounder('x', [product()]).retention).toBe(0)
  })

  it('reports no retention signal when TrustMRR sends customers: 0', () => {
    // The live API returns customers: 0 on most listings while
    // activeSubscriptions holds the real count. Absence must not read as
    // "everybody churned".
    const a = aggregateFounder('stan', [product({ customers: 0, activeSubscriptions: 101_590 })])
    expect(a.hasRetentionSignal).toBe(false)
    expect(a.retention).toBe(0)
    // ARPU must divide by something real, or every big business becomes a Rogue.
    expect(a.effectiveCustomers).toBe(101_590)
  })

  it('clamps retention to 1 when subscriptions exceed the customer count', () => {
    const a = aggregateFounder('x', [product({ customers: 10, activeSubscriptions: 40 })])
    expect(a.retention).toBe(1)
    expect(a.hasRetentionSignal).toBe(true)
  })

  it('weights growth by MRR', () => {
    const a = aggregateFounder('x', [
      product({ slug: 'big', mrrUsd: 900, growthMrr30d: 10 }),
      product({ slug: 'small', mrrUsd: 100, growthMrr30d: 100 }),
    ])
    // (900×10 + 100×100) / 1000 = 19
    expect(a.growthMrr30d).toBe(19)
  })

  it('falls back to a plain average when nobody is earning', () => {
    const a = aggregateFounder('x', [
      product({ slug: 'a', mrrUsd: 0, growthMrr30d: 10 }),
      product({ slug: 'b', mrrUsd: 0, growthMrr30d: 30 }),
    ])
    expect(a.growthMrr30d).toBe(20)
  })

  it('ignores products with no growth data', () => {
    const a = aggregateFounder('x', [
      product({ slug: 'a', mrrUsd: 100, growthMrr30d: null }),
      product({ slug: 'b', mrrUsd: 100, growthMrr30d: 40 }),
    ])
    expect(a.growthMrr30d).toBe(40)
  })

  it('keeps the best domain rating and the earliest founding date', () => {
    const a = aggregateFounder('x', [
      product({ slug: 'a', domainRating: 12, foundedDate: '2023-06-01' }),
      product({ slug: 'b', domainRating: 55, foundedDate: '2019-01-15' }),
    ])
    expect(a.domainRating).toBe(55)
    expect(a.foundedFirst).toBe('2019-01-15')
  })

  it('deduplicates channels and stack across products', () => {
    const a = aggregateFounder('x', [
      product({ slug: 'a', channels: ['seo', 'x-twitter'], stack: ['nextjs'] }),
      product({ slug: 'b', channels: ['seo'], stack: ['nextjs', 'anthropic'] }),
    ])
    expect(a.channels).toEqual(['seo', 'x-twitter'])
    expect(a.stack).toEqual(['anthropic', 'nextjs'])
  })

  it('never lists the founder as their own cofounder', () => {
    const a = aggregateFounder('marc', [product({ cofounders: ['marc', 'pierre'] })])
    expect(a.cofounders).toEqual(['pierre'])
  })

  it('accepts a founder with no products at all', () => {
    const a = aggregateFounder('empty', [])
    expect(a.nProducts).toBe(0)
    expect(a.growthMrr30d).toBe(0)
    expect(a.foundedFirst).toBeNull()
    expect(a.realm).toBeNull()
    expect(a.faction).toBeNull()
  })

  describe('realm and faction', () => {
    it('takes the commonest answer, not the first', () => {
      const a = aggregateFounder('x', [
        product({ slug: 'a', country: 'US', businessType: 'B2C' }),
        product({ slug: 'b', country: 'FR', businessType: 'B2B' }),
        product({ slug: 'c', country: 'FR', businessType: 'B2B' }),
      ])
      expect(a.realm).toBe('FR')
      expect(a.faction).toBe('B2B')
    })

    it('ignores the gaps rather than letting them win', () => {
      const a = aggregateFounder('x', [
        product({ slug: 'a', country: null, businessType: null }),
        product({ slug: 'b', country: null, businessType: null }),
        product({ slug: 'c', country: 'PL', businessType: 'Both' }),
      ])
      expect(a.realm).toBe('PL')
      expect(a.faction).toBe('Both')
    })

    it('rejects a business type outside the three known answers', () => {
      // 'Unknown' is a real value in the payload and it is not an answer.
      const a = aggregateFounder('x', [product({ businessType: 'Unknown' })])
      expect(a.faction).toBeNull()
    })

    it('leaves both null when nothing was ever reported', () => {
      const a = aggregateFounder('x', [product(), product({ slug: 'b' })])
      expect(a.realm).toBeNull()
      expect(a.faction).toBeNull()
    })
  })
})
