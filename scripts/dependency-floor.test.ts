import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Version floors for the packages the November 2026 prod audit flagged.
 *
 * next below 16.4.1 carries RCE advisories in next/og ImageResponse, the
 * image optimizer and `use cache`. sharp below 0.35.5 carries the libvips,
 * libheif and librsvg advisories. Reading the installed package.json, not
 * the range in ours, is the point: a lockfile can hold an old version under
 * a range that looks fine.
 */

const require = createRequire(import.meta.url)

function installed(name: string): string {
  // sharp does not export ./package.json, so resolve its entry and walk up.
  let dir = dirname(require.resolve(name, { paths: [require.resolve('next')] }))
  for (;;) {
    const pkg = join(dir, 'package.json')
    if (existsSync(pkg)) {
      const json = JSON.parse(readFileSync(pkg, 'utf8'))
      if (json.name === name) return json.version
    }
    const up = dirname(dir)
    if (up === dir) throw new Error(`no package.json for ${name}`)
    dir = up
  }
}

function atLeast(version: string, floor: string): boolean {
  const a = (version.split('-')[0] ?? '').split('.').map(Number)
  const b = floor.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return true
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(ts|tsx)$/.test(entry) ? [path] : []
  })
}

describe('dependency floors', () => {
  it('compares versions the way the floors need', () => {
    expect(atLeast('16.4.1', '16.4.1')).toBe(true)
    expect(atLeast('16.4.6', '16.4.1')).toBe(true)
    expect(atLeast('16.3.9', '16.4.1')).toBe(false)
    expect(atLeast('0.34.5', '0.35.5')).toBe(false)
  })

  it('runs next 16.4.1 or later', () => {
    expect(atLeast(installed('next'), '16.4.1')).toBe(true)
  })

  it('runs sharp 0.35.5 or later', () => {
    expect(atLeast(installed('sharp'), '0.35.5')).toBe(true)
  })

  it('renders images through next/og, never a separate @vercel/og', () => {
    // A direct @vercel/og ships its own satori and sharp, outside the
    // versions next is patched with.
    const offenders = ['app', 'lib', 'components']
      .flatMap(sources)
      .filter((file) => readFileSync(file, 'utf8').includes("from '@vercel/og'"))
    expect(offenders).toEqual([])
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    expect(pkg.dependencies['@vercel/og']).toBeUndefined()
  })
})
