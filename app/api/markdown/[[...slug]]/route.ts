import {
  characterMarkdown,
  homeMarkdown,
  ladderMarkdown,
  rulesMarkdown,
} from '@/lib/markdown/pages'
import { notFoundMarkdown } from '@/lib/markdown/site'
import {
  getCharacter,
  getClassCounts,
  getFactionCounts,
  getLadder,
  getRealmCounts,
  getRealmStats,
} from '@/lib/queries'

/**
 * The markdown representation of every page that has one.
 *
 * Nothing routes here directly: `proxy.ts` rewrites onto it when the request
 * negotiated `text/markdown`, or when the URL ended in `.md`. The address bar
 * still says /ladder, which is the point of content negotiation — one URL, two
 * representations, and `Vary: Accept` so a cache keeps them apart.
 *
 * It lives under /api/ so the proxy's matcher skips it and cannot loop.
 */

const MARKDOWN_HEADERS = {
  'Content-Type': 'text/markdown; charset=utf-8',
  Vary: 'Accept',
  // The corpus is written once a night, so the markdown is as stale as the
  // page it mirrors and no staler.
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
} as const

function markdown(body: string, status = 200): Response {
  return new Response(body, { status, headers: MARKDOWN_HEADERS })
}

function missing(pathname: string): Response {
  return markdown(notFoundMarkdown(pathname), 404)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug?: string[] }> },
): Promise<Response> {
  const { slug = [] } = await params
  const pathname = `/${slug.join('/')}`
  const search = new URL(request.url).searchParams

  if (slug.length === 0) {
    const [stats, ladder, factions, classes, realms] = await Promise.all([
      getRealmStats(),
      getLadder({ page: 1 }),
      getFactionCounts(),
      getClassCounts(),
      getRealmCounts(),
    ])
    return markdown(
      homeMarkdown({
        stats,
        top: ladder.rows.slice(0, 25),
        factions,
        classes,
        realms: realms.slice(0, 11),
      }),
    )
  }

  if (slug.length === 1 && slug[0] === 'rules') {
    return markdown(rulesMarkdown())
  }

  if (slug.length === 1 && slug[0] === 'ladder') {
    const realm = search.get('realm')
    const characterClass = search.get('class')
    const faction = search.get('faction')
    const achievement = search.get('ach')
    const page = Number(search.get('page') ?? '1')

    const ladder = await getLadder({
      realm,
      characterClass,
      faction,
      achievement,
      page: Number.isFinite(page) && page > 0 ? page : 1,
    })

    // The label exists so the body says which slice of the corpus it is. A
    // markdown file gets saved; "4,237 founders" on a page of 78 would be a lie
    // the moment it leaves the request.
    const filterLabel =
      [
        realm ? `realm ${realm}` : null,
        characterClass ? `class ${characterClass}` : null,
        faction ? `faction ${faction}` : null,
        achievement ? `achievement ${achievement}` : null,
      ]
        .filter(Boolean)
        .join(', ') || null

    return markdown(ladderMarkdown({ rows: ladder.rows, total: ladder.total, filterLabel }))
  }

  const handle = slug[1]
  if (slug.length === 2 && slug[0] === 'c' && handle) {
    const character = await getCharacter(handle)
    // Null covers both "never in the corpus" and "opted out", and the markdown
    // must not tell those apart any more than the HTML sheet does.
    if (!character) return missing(pathname)

    return markdown(
      characterMarkdown({
        handle: character.handle,
        displayName: character.displayName,
        level: character.level,
        ilvl: character.ilvl,
        characterClass: character.characterClass,
        rarity: character.rarity,
        xp: character.xp,
        nProducts: character.nProducts,
        mrrUsd: character.mrrUsd,
        revenueTotalUsd: character.revenueTotalUsd,
        rank: character.rank,
        profile: character.profile,
        stats: character.stats,
        equipment: character.equipment,
        achievements: character.achievements,
        computedAt: new Date().toISOString(),
      }),
    )
  }

  return missing(pathname)
}
