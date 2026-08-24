import { describe, expect, it } from 'vitest'
import { isNegotiable } from './negotiable'

describe('isNegotiable', () => {
  it('negotiates the pages that have a markdown twin', () => {
    expect(isNegotiable('/')).toBe(true)
    expect(isNegotiable('/ladder')).toBe(true)
    expect(isNegotiable('/rules')).toBe(true)
    expect(isNegotiable('/c/levelsio')).toBe(true)
  })

  /*
   * A path with no page behind it is the case the markdown 404 exists for, so
   * it has to reach the markdown route rather than fall through to the shell.
   */
  it('negotiates a path that does not exist, so the 404 can be markdown', () => {
    expect(isNegotiable('/nope-not-a-page')).toBe(true)
    expect(isNegotiable('/deep/unknown/path')).toBe(true)
  })

  /*
   * The opposite mistake, and the worse one: answering markdown for a page that
   * exists but has no twin would tell an agent the page is gone.
   */
  it('leaves pages that exist without a markdown twin on HTML', () => {
    expect(isNegotiable('/compare')).toBe(false)
    expect(isNegotiable('/c/levelsio/vs/marc')).toBe(false)
  })

  /* /icons calls notFound() in production, so on the live site it is a dead
     address like any other and gets the markdown 404. */
  it('treats the dev-only icon page as an address with nothing behind it', () => {
    expect(isNegotiable('/icons')).toBe(true)
  })

  it('never touches a file that is already machine-readable', () => {
    expect(isNegotiable('/sitemap.xml')).toBe(false)
    expect(isNegotiable('/robots.txt')).toBe(false)
    expect(isNegotiable('/llms.txt')).toBe(false)
    expect(isNegotiable('/c/levelsio/badge.svg')).toBe(false)
  })

  it('treats an explicit .md URL as markdown whatever else it looks like', () => {
    expect(isNegotiable('/rules.md')).toBe(true)
    expect(isNegotiable('/nope.md')).toBe(true)
  })
})
