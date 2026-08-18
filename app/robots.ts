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
 * Character sheets are not blocked here and no longer carry `noindex` either:
 * the corpus is indexed with TrustMRR's agreement. Consent is enforced one
 * founder at a time instead — opting out 404s the sheet, which removes it from
 * an index far more completely than a crawler rule ever could.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
