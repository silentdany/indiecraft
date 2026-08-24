/**
 * Which paths answer to `Accept`, and which are left alone.
 *
 * Three groups, and the middle one is the reason this is a file rather than a
 * line in proxy.ts:
 *
 *   1. Pages with a markdown twin — negotiated.
 *   2. Pages that exist and have no twin (/compare, /icons, a versus page) —
 *      left on HTML. Routing these to the markdown handler would answer with a
 *      404 for a page that is plainly there, which is a worse lie than serving
 *      an agent the HTML it did not ask for.
 *   3. Everything else, which is either a file that is already machine-readable
 *      or an address with nothing behind it. Files are left alone; unknown
 *      addresses are negotiated, because a markdown 404 with four links on it
 *      is the whole point of the 404 work.
 */

const MARKDOWN_PAGES = new Set(['/', '/ladder', '/rules'])

/*
 * Pages that exist for a reader and have no markdown twin.
 *
 * /icons is deliberately not here: it calls notFound() under NODE_ENV
 * production, so on the deployed site it is not a page at all and an agent
 * asking about it should get the markdown 404 like any other dead address.
 */
const HTML_ONLY_PAGES = new Set(['/compare'])

const CHARACTER_SHEET = /^\/c\/[^/]+$/
const VERSUS = /^\/c\/[^/]+\/vs\/[^/]+$/

export function hasMarkdownTwin(pathname: string): boolean {
  return MARKDOWN_PAGES.has(pathname) || CHARACTER_SHEET.test(pathname)
}

export function isNegotiable(pathname: string): boolean {
  const last = pathname.split('/').pop() ?? ''

  // The one extension that means "markdown, whatever the Accept header says".
  if (last.endsWith('.md')) return true

  // /sitemap.xml, /robots.txt, /llms.txt, badge.svg, the OG images: already
  // machine-readable, and correct as they stand.
  if (/\.[a-z0-9]+$/i.test(last)) return false

  if (hasMarkdownTwin(pathname)) return true
  if (HTML_ONLY_PAGES.has(pathname) || VERSUS.test(pathname)) return false

  // Nothing known lives here, so let the markdown route answer with its 404.
  return true
}
