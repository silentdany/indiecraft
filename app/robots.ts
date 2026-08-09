import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/**
 * `/api/` is disallowed because none of it is a page: a cron endpoint and an
 * opt-out endpoint, and nothing a crawler should ever call.
 *
 * It used to hold the character OG images too, under the belief that "crawlers
 * fetch meta-tag images regardless of robots rules". They do not. Twitterbot,
 * facebookexternalhit, LinkedInBot and Slackbot all read robots.txt first and
 * skip a disallowed image, so every character card silently failed to render
 * anywhere while returning a perfectly good 200 to anyone who checked by hand.
 * The images now live at /c/<handle>/opengraph-image, inside the segment they
 * describe. Nothing under /api/ may ever be referenced from a meta tag again.
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
