import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Cinzel has to travel with every OG route into the serverless bundle;
  // otherwise the fs read fails in production while working fine locally.
  // The glob covers all four cards, so moving or adding one cannot silently
  // leave its fonts behind — which is exactly what a per-route path did when
  // the character card moved out of /api.
  outputFileTracingIncludes: {
    '**/opengraph-image': ['./public/fonts/**'],
  },
  images: {
    // TrustMRR / X avatars. Read-only, no uploads.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
}

export default nextConfig
