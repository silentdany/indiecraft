import { describe, expect, it } from 'vitest'
import { AGENT_LINKS, llmsTxt, notFoundMarkdown } from './site'

describe('notFoundMarkdown', () => {
  it('says what happened, in a heading an agent can read', () => {
    const md = notFoundMarkdown('/does-not-exist')

    expect(md.startsWith('# 404')).toBe(true)
    expect(md).toContain('/does-not-exist')
  })

  it('hands the agent somewhere to go next', () => {
    const md = notFoundMarkdown('/x')

    expect(md).toContain('](/sitemap.xml)')
    expect(md).toContain('](/llms.txt)')
    expect(md).toContain('](/ladder)')
    expect(md).toContain('](/rules)')
  })

  it('never leaks markup from the path into the body', () => {
    const md = notFoundMarkdown('/<script>alert(1)</script>')

    expect(md).not.toContain('<script>')
  })
})

describe('llmsTxt', () => {
  const md = llmsTxt()

  /* llmstxt.org: an H1 name, then a blockquote summary, then H2 sections of links. */
  it('opens with the brand as an H1', () => {
    expect(md.startsWith('# World of Indiecraft')).toBe(true)
  })

  it('follows the H1 with a blockquote summary', () => {
    const lines = md.split('\n').filter(Boolean)
    expect(lines[1]?.startsWith('> ')).toBe(true)
  })

  it('lists the machine-readable resources agents ask for by name', () => {
    expect(md).toContain('/sitemap.xml')
    expect(md).toContain('/robots.txt')
    expect(md).toContain('.md')
  })

  it('names the pages an agent can actually fetch', () => {
    expect(md).toContain('](https://indiecraft.quest/ladder)')
    expect(md).toContain('](https://indiecraft.quest/rules)')
  })

  it('uses absolute URLs throughout, since llms.txt is read out of context', () => {
    const relativeLinks = md.match(/\]\(\/[^)]*\)/g)
    expect(relativeLinks).toBeNull()
  })
})

describe('AGENT_LINKS', () => {
  it('is the one list the 404 body and llms.txt both read from', () => {
    expect(AGENT_LINKS.length).toBeGreaterThan(0)
    for (const link of AGENT_LINKS) {
      expect(link.href.startsWith('/')).toBe(true)
      expect(link.label).not.toBe('')
    }
  })
})
