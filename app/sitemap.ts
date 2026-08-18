import type { MetadataRoute } from 'next'
import { getIndexableHandles, getLastComputedAt } from '@/lib/queries'

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
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [handles, computedAt] = await Promise.all([
    getIndexableHandles().catch(() => []),
    getLastComputedAt().catch(() => null),
  ])

  const fresh = computedAt ? new Date(computedAt) : new Date()

  return [
    { url: BASE, lastModified: fresh, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/ladder`, lastModified: fresh, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/rules`, lastModified: fresh, changeFrequency: 'monthly', priority: 0.6 },
    ...handles.map(({ handle, updatedAt }) => ({
      url: `${BASE}/c/${handle}`,
      lastModified: new Date(updatedAt),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ]
}
