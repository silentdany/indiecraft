import { describe, expect, it } from 'vitest'
import nextConfig from '../next.config'

/**
 * The two parts of next.config.ts the prod audit found missing or open: the
 * image optimizer's host list and the security headers. Both fail quietly,
 * one as a public image proxy, the other as headers that simply are not
 * there, so they are pinned here rather than left to a reviewer.
 */

async function headersFor(path: string): Promise<Map<string, string>> {
  const rules = (await nextConfig.headers?.()) ?? []
  const all = rules.filter((rule) => rule.source === '/:path*' || rule.source === path)
  return new Map(all.flatMap((rule) => rule.headers.map((h) => [h.key.toLowerCase(), h.value])))
}

describe('next.config', () => {
  it('lets the image optimizer fetch from no remote host', () => {
    expect(nextConfig.images?.remotePatterns).toEqual([])
  })

  it('sends the security headers on every path', async () => {
    const headers = await headersFor('/c/someone')
    expect(headers.get('strict-transport-security')).toMatch(/max-age=\d{8,}; includeSubDomains/)
    expect(headers.get('x-content-type-options')).toBe('nosniff')
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(headers.get('x-frame-options')).toBe('DENY')
  })

  it('keeps the CSP strict where it can be', async () => {
    const csp = (await headersFor('/')).get('content-security-policy') ?? ''
    const directive = (name: string) =>
      csp
        .split(';')
        .map((d) => d.trim())
        .find((d) => d.startsWith(`${name} `)) ?? ''
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'")
    expect(directive('object-src')).toBe("object-src 'none'")
    expect(directive('default-src')).toBe("default-src 'self'")
    // PostHog's API host must be reachable, and nothing else beyond the counters.
    const posthog = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com'
    expect(directive('connect-src')).toBe(`connect-src 'self' ${posthog} https://datafa.st`)
    expect(directive('script-src')).not.toContain("'unsafe-eval'")
    expect(directive('script-src')).not.toMatch(/\shttps:(\s|$)/)
  })
})
