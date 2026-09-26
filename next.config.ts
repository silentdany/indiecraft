import type { NextConfig } from 'next'

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
    // TrustMRR / X avatars. Read-only, no uploads.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
}

export default nextConfig
