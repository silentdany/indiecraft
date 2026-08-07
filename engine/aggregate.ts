import type { FounderAggregate, ProductInput } from './types'

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
  const customers = sum(products, (p) => p.customers)
  const activeSubscriptions = sum(products, (p) => p.activeSubscriptions)

  // TrustMRR returns customers: 0 on most listings, while activeSubscriptions
  // holds the real count. Treat the absence as absence, not as zero retention.
  const hasRetentionSignal = customers > 0

  return {
    handle,
    revenueTotalUsd,
    mrrUsd,
    customers,
    activeSubscriptions,
    nProducts: products.length,
    hasRetentionSignal,
    effectiveCustomers: customers > 0 ? customers : activeSubscriptions,
    retention: hasRetentionSignal ? Math.min(activeSubscriptions / customers, 1) : 0,
    growthMrr30d: weightedGrowth(products),
    domainRating: maxOrNull(products.map((p) => p.domainRating)),
    foundedFirst: earliest(products.map((p) => p.foundedDate)),
    channels: distinct(products.flatMap((p) => p.channels)),
    stack: distinct(products.flatMap((p) => p.stack)),
    // Nobody is their own cofounder.
    cofounders: distinct(products.flatMap((p) => p.cofounders)).filter((h) => h !== handle),
    fundingStatuses: distinct(
      products.map((p) => p.fundingStatus).filter((s): s is string => s !== null),
    ),
  }
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
