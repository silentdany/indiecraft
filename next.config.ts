import type { NextConfig } from 'next'

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com'

/*
 * The CSP the pages can live with, and why each loose part is loose.
 *
 * script-src keeps 'unsafe-inline' because every page is static or ISR, and
 * Next's inline bootstrap scripts can only carry a nonce on a dynamic render.
 * Trading the cache for a nonce is not worth it on a site with no forms that
 * post and no user content rendered as HTML.
 *
 * img-src is `https:` because product icons come from any host a founder put
 * on TrustMRR (seen on live sheets: CloudFront, files.stripe.com, Whop), and
 * a missing icon is a broken sheet. Images cannot run code; the strict part
 * of the policy is scripts, connections and framing.
 *
 * DataFast is the layout's second counter (app/layout.tsx): its script and
 * its event endpoint are both on datafa.st.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://datafa.st`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${POSTHOG_HOST} https://datafa.st`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  // Cinzel has to travel with every OG route into the serverless bundle;
  // otherwise the fs read fails in production while working fine locally.
  // The glob covers all four cards, so moving or adding one cannot silently
  // leave its fonts behind — which is exactly what a per-route path did when
  // the character card moved out of /api.
  outputFileTracingIncludes: {
    '**/opengraph-image': ['./public/fonts/**'],
    // The poster route is /c/[handle]/poster/[id], not opengraph-image, so the
    // glob above does not see it. Same failure if it is missing: the font read
    // works locally and 500s once the route is deployed on its own.
    '**/poster/**': ['./public/fonts/**'],
  },
  images: {
    /*
     * No remote host at all, on purpose.
     *
     * Nothing renders through next/image: avatars (pbs.twimg.com), product
     * icons (whatever host a founder gave TrustMRR) and class icons
     * (render.worldofwarcraft.com) are all plain <img>, and the OG routes
     * fetch their own bytes. The `**` that used to sit here served no page and
     * turned /_next/image into a proxy for any HTTPS image on the internet.
     */
    remotePatterns: [],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
