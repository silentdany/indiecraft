import type { Faction, FounderAggregate, ProductInput } from './types'

const FACTIONS: readonly Faction[] = ['B2B', 'B2C', 'Both']

/**
 * Founder aggregation.
 *
 * The founder is identified by their xHandle, and every metric is the sum of
 * their startups: "5 products shipped" is a stat about a person, not a product.
 *
 * Pure function. No database access.
 */
export function aggregateFounder(handle: string, products: ProductInput[]): FounderAggregate {
  const revenueTotalUsd = sum(products, (p) => p.revenueTotalUsd)
  const mrrUsd = sum(products, (p) => p.mrrUsd)
  const last30dUsd = sum(products, (p) => p.last30dUsd)
  const customers = sum(products, (p) => p.customers)
  const activeSubscriptions = sum(products, (p) => p.activeSubscriptions)

  // TrustMRR returns customers: 0 on most listings, while activeSubscriptions
  // holds the real count. Treat the absence as absence, not as zero retention.
  const hasRetentionSignal = customers > 0

  return {
    handle,
    revenueTotalUsd,
    mrrUsd,
    last30dUsd,
    customers,
    activeSubscriptions,
    nProducts: products.length,
    hasRetentionSignal,
    effectiveCustomers: customers > 0 ? customers : activeSubscriptions,
    retention: hasRetentionSignal ? Math.min(activeSubscriptions / customers, 1) : 0,
    growthMrr30d: weightedGrowth(products),
    domainRating: maxOrNull(products.map((p) => p.domainRating)),
    // The best of them, not the sum: a founder has one audience, listed once
    // against each of their products.
    followers: maxOrNull(products.map((p) => p.followers)),
    foundedFirst: earliest(products.map((p) => p.foundedDate)),
    channels: distinct(products.flatMap((p) => p.channels)),
    stack: distinct(products.flatMap((p) => p.stack)),
    // Nobody is their own cofounder.
    cofounders: distinct(products.flatMap((p) => p.cofounders)).filter((h) => h !== handle),
    fundingStatuses: distinct(
      products.map((p) => p.fundingStatus).filter((s): s is string => s !== null),
    ),
    realm: commonest(products.map((p) => p.country)),
    faction: asFaction(commonest(products.map((p) => p.businessType))),

    visitors30d: sum(products, (p) => p.visitors30d ?? 0),
    categories: distinct(products.map((p) => p.category).filter((c): c is string => Boolean(c))),
    hasMobileApp: products.some((p) => p.isMobileApp),
    // The best margin, not the average: a founder with one 95% product and one
    // loss-making experiment has demonstrably built a 95% business.
    profitMargin30d: maxOrNull(products.map((p) => p.profitMargin30d)),
    googleImpressions30d: sum(products, (p) => p.googleImpressions30d ?? 0),
    everListedForSale: products.some((p) => p.listedForSaleAt !== null),
    // Two or more, because "all one of my products earns" is not a portfolio
    // statement, it is the same fact as having any revenue at all.
    allProductsEarning: products.length >= 2 && products.every((p) => p.mrrUsd > 0),
  }
}

/**
 * The value that appears most often, ignoring the gaps.
 *
 * Ties break on the first product, which is stable because the caller hands
 * products in a fixed order. A tie is also genuinely ambiguous — a founder with
 * one US product and one French one is not more one than the other — so the
 * important property is that the answer never flickers between nightly runs,
 * not that it is somehow more correct.
 */
function commonest(values: (string | null)[]): string | null {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (value === null || value.length === 0) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }
  return best
}

/** Anything outside the three known answers — 'Unknown' included — is no answer. */
function asFaction(value: string | null): Faction | null {
  return FACTIONS.find((f) => f === value) ?? null
}

/** MRR-weighted average of growthMRR30d: a $0 product carries no weight. */
function weightedGrowth(products: ProductInput[]): number {
  const withGrowth = products.filter((p) => p.growthMrr30d !== null)
  if (withGrowth.length === 0) return 0

  const totalWeight = sum(withGrowth, (p) => p.mrrUsd)
  if (totalWeight <= 0) {
    // Nobody is earning yet — plain average, otherwise we divide by zero.
    return sum(withGrowth, (p) => p.growthMrr30d ?? 0) / withGrowth.length
  }
  return sum(withGrowth, (p) => (p.growthMrr30d ?? 0) * p.mrrUsd) / totalWeight
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + (pick(item) || 0), 0)
}

function distinct(values: string[]): string[] {
  return [...new Set(values)].sort()
}

function maxOrNull(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null)
  return present.length ? Math.max(...present) : null
}

function earliest(dates: (string | null)[]): string | null {
  const present = dates.filter((d): d is string => Boolean(d)).sort()
  return present[0] ?? null
}
