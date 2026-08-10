import { getComparableFounders } from '@/lib/queries'

/**
 * Typeahead for the compare picker.
 *
 * Under /api/ and therefore disallowed in robots.txt, which is correct: it is
 * not a page, it returns at most eight rows, and every founder in it is already
 * listed on the ladder. Nothing here is reachable that was not already public.
 *
 * The picker used to hold the whole corpus in the browser and filter locally.
 * That was the right call at 142 founders and stopped being one the moment the
 * crawler could see the rest of TrustMRR.
 */
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q') ?? ''
  const founders = await getComparableFounders(query.slice(0, 60))
  return Response.json(
    { founders },
    // Briefly cacheable at the edge: the same few prefixes get typed constantly
    // and the answer only changes once a night.
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' } },
  )
}
