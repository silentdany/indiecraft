import { type NextRequest, NextResponse } from 'next/server'
import { appendVaryAccept, preferredType } from '@/lib/accept'
import { isNegotiable } from '@/lib/negotiable'

/**
 * Markdown content negotiation, to acceptmarkdown.com's spec.
 *
 * One URL serves two representations: the armory to a browser, the same facts
 * as prose to an agent that asks for `text/markdown`. Both answers carry
 * `Vary: Accept`, without which a CDN hands the cached markdown to the next
 * browser that asks for the same URL.
 *
 * `proxy.ts` and not `middleware.ts`: Next 16 renamed the convention, and the
 * old name is deprecated.
 */

function toMarkdownRoute(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = `/api/markdown${pathname === '/' ? '' : pathname}`
  const rewritten = NextResponse.rewrite(url)
  appendVaryAccept(rewritten.headers)
  return rewritten
}

export function proxy(request: NextRequest): NextResponse | Response {
  const { pathname } = request.nextUrl

  /*
   * An explicit `.md` URL is markdown whatever the Accept header says. It is
   * the address a crawler can link to and quote, and crawlers that follow it
   * often send no Accept header at all.
   */
  if (pathname.endsWith('.md')) {
    return toMarkdownRoute(request, pathname.slice(0, -3) || '/')
  }

  const accept = request.headers.get('accept')

  if (isNegotiable(pathname)) {
    const chosen = preferredType(accept)

    if (chosen === 'text/markdown') return toMarkdownRoute(request, pathname)

    /*
     * RFC 9110 § 15.5.7. Only when the client sent an Accept it can be held to
     * and nothing in it matches: falling back to HTML there would answer a
     * question nobody asked.
     */
    if (chosen === null && accept) {
      return new Response('Not Acceptable\n\nAvailable: text/html, text/markdown\n', {
        status: 406,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', Vary: 'Accept' },
      })
    }
  }

  /*
   * The HTML branch, and the one honest caveat in this file.
   *
   * `Vary: Accept` is set here and it does not survive: Next writes its own
   * Vary (`rsc, next-router-state-tree, …`) onto App Router page responses
   * after the proxy has run, and that write replaces rather than merges.
   * Declaring it in next.config's `headers()` does not survive either — a
   * probe header set alongside it does, so the overwrite is specific to Vary
   * rather than config headers being dropped.
   *
   * What this costs, and what it does not. It does not affect Vercel's own
   * cache: the proxy runs before the cache lookup, so a markdown request is
   * rewritten onto /api/markdown and never reads the HTML entry, whatever the
   * HTML entry's Vary says. The markdown response carries `Vary: Accept` from
   * the route handler itself, which is the one place a header is safe from the
   * overwrite. What is left uncovered is a downstream cache — a corporate
   * proxy, an agent's own store — that saw the HTML first and does not know
   * the URL varies. Closing that would mean overriding Vary at the Vercel edge
   * and dropping the RSC values Next puts there, which trades a cache
   * correctness edge case for broken client-side navigation.
   *
   * The call stays because it is free, correct, and stops being a no-op the
   * day Next merges instead of replaces.
   */
  const response = NextResponse.next()
  appendVaryAccept(response.headers)
  return response
}

export const config = {
  // Next's own plumbing and the API are out, and the API includes the markdown
  // route this rewrites onto — so a rewrite can never re-enter here. Static
  // files are filtered in `isNegotiable` rather than here, because the one
  // extension that must still reach this function is `.md`.
  matcher: ['/((?!api/|_next/|_vercel/).*)'],
}
