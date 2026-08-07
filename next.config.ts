import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Cinzel has to travel with the OG route into the serverless bundle;
  // otherwise the fs read fails in production while working fine locally.
  outputFileTracingIncludes: {
    '/api/og/c/[handle]': ['./public/fonts/**'],
  },
  images: {
    // TrustMRR / X avatars. Read-only, no uploads.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
}

export default nextConfig
