/**
 * The two documents that exist for agents rather than for readers: the body of
 * a 404, and llms.txt.
 *
 * Both answer the same question from different ends — "you are somewhere that
 * is not a page, here is the shape of the site" — so both read from one list of
 * links. Two lists would drift, and the one that drifted would be the one
 * nobody looks at.
 */

/**
 * Where an agent is sent when it has nowhere else to go.
 *
 * Ordered by how much of the site each one explains: the ladder IS the product,
 * the rules explain every number on it, and the last two are the machine-
 * readable indexes that let a crawler stop guessing at URLs.
 */
export interface AgentLink {
  href: string
  label: string
  hint: string
}

export const AGENT_LINKS: readonly AgentLink[] = [
  { href: '/ladder', label: 'The ladder', hint: 'Every founder in the corpus, ranked' },
  { href: '/rules', label: 'The rules', hint: 'How every number on the site is worked out' },
  { href: '/llms.txt', label: 'llms.txt', hint: 'This site, summarised for agents' },
  { href: '/sitemap.xml', label: 'Sitemap', hint: 'Every indexable URL' },
]

/**
 * The apex, hard-coded rather than read from `NEXT_PUBLIC_SITE_URL`.
 *
 * llms.txt is fetched once and quoted elsewhere, so a relative link or a
 * preview-deployment host in it outlives the request that produced it. There is
 * exactly one origin this file may ever name.
 */
export const CANONICAL_ORIGIN = 'https://indiecraft.quest'

/** A path arrives from the URL bar, so it is data, not markup. */
function safePath(pathname: string): string {
  return pathname.replace(/[<>`]/g, '').slice(0, 200)
}

function bullet(link: AgentLink, origin = ''): string {
  return `- [${link.label}](${origin}${link.href}) — ${link.hint}`
}

/**
 * The markdown body of a 404.
 *
 * A crawler that hits a dead URL and gets back an app shell learns nothing; one
 * that gets back four links learns the whole site in one response.
 */
export function notFoundMarkdown(pathname: string): string {
  return [
    '# 404 — no such page',
    '',
    `\`${safePath(pathname)}\` is not a page on World of Indiecraft.`,
    '',
    '## Where to look next',
    '',
    ...AGENT_LINKS.map((link) => bullet(link)),
    '',
    'Every page on this site also answers `Accept: text/markdown`, or the same URL with `.md` on the end.',
    '',
  ].join('\n')
}

/**
 * llms.txt, in the llmstxt.org shape: an H1 name, a blockquote summary, then
 * H2 sections of annotated links and nothing else.
 *
 * The audit that asked for this asked for two things at once — that the
 * developer-facing surface be discoverable by name, and that the brand be
 * findable — so the product name is spelled out here rather than left to the
 * domain.
 */
export function llmsTxt(origin: string = CANONICAL_ORIGIN): string {
  return [
    '# World of Indiecraft',
    '',
    "> A public armory for indie founders, built on TrustMRR data. Lifetime revenue is XP, every stat is an equipment slot, and item level is the average of a founder's gear. World of Indiecraft ranks 4,000+ real founders by numbers that are countable and falsifiable.",
    '',
    'Nothing here is self-reported. Every figure comes from the nightly compute step over the TrustMRR corpus, and the rules page states exactly how each one is derived.',
    '',
    '## Pages',
    '',
    `- [The ladder](${origin}/ladder) — every founder in the corpus, ranked, filterable by realm, class, faction and achievement`,
    `- [The rules](${origin}/rules) — the level table, the class tree, the rarity bands, all seventeen equipment slots, the quest log and every achievement`,
    `- [Compare founders](${origin}/compare) — two characters side by side`,
    `- [Poster](${origin}/card) — a free 9:16 card of any founder, at /c/<handle>/poster/<level>-<ilvl>`,
    `- [Character sheets](${origin}/c/) — one page per founder, at /c/<handle>`,
    '',
    '## For agents and developers',
    '',
    `- [Markdown variants](${origin}/llms.txt) — every page answers \`Accept: text/markdown\`, or the same URL with \`.md\` appended`,
    `- [Sitemap](${origin}/sitemap.xml) — every indexable URL, refreshed nightly`,
    `- [robots.txt](${origin}/robots.txt) — crawl rules; \`/api/\` is not a page and is disallowed`,
    `- [Character badge](${origin}/c/pieterlevels/badge.svg) — an SVG rank badge for any handle, at /c/<handle>/badge.svg`,
    '- [Source code](https://github.com/silentdany/indiecraft) — the whole site, MIT licensed, including the scoring engine',
    '',
    '## Notes',
    '',
    '- Data refreshes once a night; `computed_at` on each sheet says when.',
    '- A founder can opt out, which removes their sheet entirely rather than hiding it.',
    '',
  ].join('\n')
}
