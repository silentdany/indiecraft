import type { MetadataRoute } from 'next'
import { getIndexableHandles, getLastComputedAt } from '@/lib/queries'

export const revalidate = 3600

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/**
 * Character sheets appear here only once claimed.
 *
 * Every sheet carries `noindex` until its founder claims it, so listing an
 * unclaimed one would be inviting a crawler to a page that turns it away —
 * noise at best, and at worst an end-run around the one consent rule the
 * product has. Right now that means the sitemap is three URLs, which is the
 * correct answer rather than a bug.
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
