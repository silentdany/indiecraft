import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import nextConfig from '../next.config'

/**
 * DataFast was removed on purpose: it kept a visitor id in a cookie and in
 * web storage on every page, with no consent asked. Nothing here should load
 * it again, and the CSP should not leave a door open for it.
 */

const DATAFAST = /datafa\.st|data-website-id|dfid_/i

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(ts|tsx|js|mjs)$/.test(entry) ? [path] : []
  })
}

describe('DataFast stays out', () => {
  it('is not loaded by the root layout', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8')
    expect(layout).not.toMatch(DATAFAST)
  })

  it('is not referenced by any page, component or library', () => {
    const offenders = ['app', 'components', 'lib']
      .flatMap(sources)
      .filter((file) => DATAFAST.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('has no host in the CSP', async () => {
    const rules = (await nextConfig.headers?.()) ?? []
    const csp = rules
      .flatMap((rule) => rule.headers)
      .filter((h) => h.key.toLowerCase() === 'content-security-policy')
      .map((h) => h.value)
    expect(csp.length).toBeGreaterThan(0)
    for (const value of csp) expect(value).not.toMatch(/datafa/i)
  })
})
