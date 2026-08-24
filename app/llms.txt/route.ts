import { llmsTxt } from '@/lib/markdown/site'

/**
 * llms.txt, in the llmstxt.org shape.
 *
 * Served from a route rather than dropped in public/ so the body has one
 * source — `lib/markdown/site.ts`, which the 404 reads from too — and so it
 * carries a content type and a cache header of its own.
 *
 * text/plain, not text/markdown: llms.txt is markdown by convention but every
 * published example serves it as plain text, and an agent that fetched it by
 * name already knows what it is.
 */
export const dynamic = 'force-static'

export function GET(): Response {
  return new Response(llmsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
