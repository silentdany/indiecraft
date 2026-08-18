import type { MetadataRoute } from 'next'
import {
  getAchievementCounts,
  getClassCounts,
  getFactionCounts,
  getIndexableHandles,
  getLastComputedAt,
  getRealmCounts,
} from '@/lib/queries'

export const revalidate = 3600

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/**
 * Every sheet with something on it, plus the three standing pages.
 *
 * This was three URLs until TrustMRR's founder agreed to the corpus being
 * indexed: sheets carried `noindex` until claimed, one founder in 3,900 ever
 * claimed, and the sitemap correctly reflected that nothing was indexable. The
 * permission changed, so the file did.
 *
 * `getIndexableHandles` decides which sheets qualify and says why — consent is
 * absolute there, thinness is a judgement.
 *
 * The facet views are here on the same terms. A single facet is indexable at
 * any size — see the ladder's `filtered` — but only the ones holding a readable
 * number of founders are submitted, because asking a crawler to fetch a realm
 * with three people in it spends budget proving the page is thin.
 */
/**
 * Founders a facet needs before it is worth submitting.
 *
 * Fifty is where the corpus stops producing pages that are mostly whitespace:
 * it keeps 12 realms of 101, 9 classes of 11, all 3 factions and 26 badges of
 * 35 — about fifty pages, each with at least half a screen of ladder on it.
 */
const FACET_MIN = 50

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [handles, computedAt, realms, classes, factions, badges] = await Promise.all([
    getIndexableHandles().catch(() => []),
    getLastComputedAt().catch(() => null),
    getRealmCounts().catch(() => []),
    getClassCounts().catch(() => []),
    getFactionCounts().catch(() => []),
    getAchievementCounts().catch(() => []),
  ])

  const fresh = computedAt ? new Date(computedAt) : new Date()

  const facets = [
    ...realms.filter((r) => r.count >= FACET_MIN).map((r) => `realm=${r.value}`),
    ...classes.filter((c) => c.count >= FACET_MIN).map((c) => `class=${c.name}`),
    ...factions.filter((f) => f.count >= FACET_MIN).map((f) => `faction=${f.value}`),
    ...badges.filter((b) => b.count >= FACET_MIN).map((b) => `ach=${b.value}`),
  ]

  return [
    { url: BASE, lastModified: fresh, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/ladder`, lastModified: fresh, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/rules`, lastModified: fresh, changeFrequency: 'monthly', priority: 0.6 },
    ...facets.map((query) => ({
      url: `${BASE}/ladder?${query}`,
      lastModified: fresh,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    ...handles.map(({ handle, updatedAt }) => ({
      url: `${BASE}/c/${handle}`,
      lastModified: new Date(updatedAt),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ]
}
