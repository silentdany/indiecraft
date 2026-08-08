import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/**
 * `/api/` is disallowed because none of it is a page. The OG routes under it
 * are referenced from meta tags, which crawlers fetch regardless of robots
 * rules, so nothing that matters is lost by keeping them out of the index.
 *
 * Unclaimed character sheets are not blocked here — they carry `noindex`
 * instead, deliberately. A crawler has to be allowed to fetch a page to read
 * the tag that tells it to forget the page.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
