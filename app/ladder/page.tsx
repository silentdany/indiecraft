import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icon'
import { JsonLd } from '@/components/json-ld'
import { LadderTable } from '@/components/ladder-table'
import { CLASS_COLORS, FACTIONS, FACTIONS_BY_KEY } from '@/engine'
import type { CharacterClass } from '@/engine/types'
import {
  getClassCounts,
  getFactionCounts,
  getLadder,
  getRealmCounts,
  type LadderFilter,
} from '@/lib/queries'
import { normalizeRealm, realmLabel } from '@/lib/realm'

export const revalidate = 300

type Search = { class?: string; realm?: string; faction?: string }

/**
 * A filtered ladder is a different page and has to say so.
 *
 * "The ladder" as a title on /ladder?realm=FR is a lie a search result will
 * repeat, and a shared link that reads "The ladder" tells nobody what they are
 * about to open. Every facet the visitor picked goes in the title, in the
 * description, and in the canonical — so the four narrow views a founder
 * actually wants to share each have an identity of their own.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>
}): Promise<Metadata> {
  const search = await searchParams
  const { title, description, canonical, filtered } = describe(search)
  return {
    title,
    description,
    alternates: { canonical },
    /*
     * Filtered views are noindex, and this is a consent decision rather than an
     * SEO one.
     *
     * Ten classes by three factions by twenty-four realms is roughly seven
     * hundred pages, each naming founders who never asked to be listed
     * anywhere. The bare ladder already carries that exposure once and is left
     * exactly as it was; multiplying it by seven hundred because the facets
     * happened to be cheap to build is not a decision a feature gets to make on
     * its own. The pages work, they are linked, and people can share them —
     * they are just not submitted to be crawled.
     */
    robots: filtered ? { index: false, follow: true } : undefined,
  }
}

export default async function Ladder({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams
  const filter = toFilter(search)

  const [rows, classes, realms, factions] = await Promise.all([
    getLadder(filter),
    getClassCounts(),
    getRealmCounts(),
    getFactionCounts(),
  ])

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const { title, heading, description, filtered } = describe(search)

  return (
    <main className="page">
      {/* Ten entries, not a hundred: enough for a search engine to understand
          that this is a ranking, without shipping a kilobyte of JSON nobody
          reads. */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: title,
          description,
          numberOfItems: rows.length,
          itemListElement: rows.slice(0, 10).map((row) => ({
            '@type': 'ListItem',
            position: row.rank,
            name: `@${row.handle}`,
            url: `${site}/c/${row.handle}`,
          })),
        }}
      />

      <header className="section-head">
        <h1 className="serif gold" style={{ fontSize: 22, letterSpacing: '0.14em', margin: 0 }}>
          {heading}
        </h1>
        {/* No bottom rankings. We show a top, never the floor. */}
        <span className="label">
          {filtered ? `${rows.length} of the top 100` : 'Top 100 by level, then iLvl'}
        </span>
      </header>

      <div className="facets">
        <Facet
          label="Class"
          all={href(search, { class: undefined })}
          active={!!filter.characterClass}
        >
          {classes.map((c) => (
            <FacetLink
              key={c.name}
              href={href(search, { class: c.name })}
              current={filter.characterClass === c.name}
              count={c.count}
              color={CLASS_COLORS[c.name as CharacterClass]}
            >
              <Icon name={c.name as CharacterClass} size={13} />
              {c.name}
            </FacetLink>
          ))}
        </Facet>

        <Facet label="Faction" all={href(search, { faction: undefined })} active={!!filter.faction}>
          {factions.map((f) => {
            const def = FACTIONS_BY_KEY.get(f.value)
            return (
              <FacetLink
                key={f.value}
                href={href(search, { faction: f.value })}
                current={filter.faction === f.value}
                count={f.count}
                color={def?.color}
                title={def?.tagline}
              >
                <Icon name={f.value} size={13} />
                {f.value}
              </FacetLink>
            )
          })}
        </Facet>

        {/* Twelve realms, not twenty-eight: the tail is realms of one, and a
            row of them would bury the eight that hold most of the corpus. The
            long tail is still reachable — every character sheet links its own
            realm, which is where anybody who cares about SI arrives from. */}
        <Facet label="Realm" all={href(search, { realm: undefined })} active={!!filter.realm}>
          {realms.slice(0, 12).map((r) => (
            <FacetLink
              key={r.value}
              href={href(search, { realm: r.value })}
              current={filter.realm === r.value}
              count={r.count}
              title={realmLabel(r.value)}
            >
              <span className="serif">{r.value}</span>
            </FacetLink>
          ))}
          {filter.realm && !realms.slice(0, 12).some((r) => r.value === filter.realm) && (
            <FacetLink href={href(search, { realm: filter.realm })} current count={rows.length}>
              <span className="serif">{filter.realm}</span>
            </FacetLink>
          )}
        </Facet>
      </div>

      <LadderTable rows={rows} />
    </main>
  )
}

function Facet({
  label,
  all,
  active,
  children,
}: {
  label: string
  all: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <div className="facet">
      <span className="facet-label label">{label}</span>
      <nav className="tabs" aria-label={`Filter by ${label.toLowerCase()}`}>
        <Link href={all} className="tab" aria-current={active ? undefined : 'page'}>
          All
        </Link>
        {children}
      </nav>
    </div>
  )
}

function FacetLink({
  href,
  current,
  count,
  color,
  title,
  children,
}: {
  href: string
  current: boolean
  count: number
  color?: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="tab"
      aria-current={current ? 'page' : undefined}
      title={title}
      style={color ? ({ '--tab-color': color } as React.CSSProperties) : undefined}
    >
      {children} <span className="tab-count">{count}</span>
    </Link>
  )
}

/** Facets compose, so picking one has to preserve the others. */
function href(search: Search, patch: Partial<Search>): string {
  const next = { ...search, ...patch }
  const params = new URLSearchParams()
  if (next.class) params.set('class', next.class)
  if (next.faction) params.set('faction', next.faction)
  if (next.realm) params.set('realm', next.realm)
  const query = params.toString()
  return query ? `/ladder?${query}` : '/ladder'
}

function toFilter(search: Search): LadderFilter {
  return {
    characterClass: search.class ?? null,
    realm: normalizeRealm(search.realm),
    faction: search.faction ?? null,
  }
}

/** One place that names a filtered ladder, so the h1, the title and the JSON-LD agree. */
function describe(search: Search): {
  title: string
  heading: string
  description: string
  canonical: string
  filtered: boolean
} {
  const filter = toFilter(search)
  // By value rather than by key: `filter.faction` is whatever was in the query
  // string, and looking it up in the map would need a cast that asserts away
  // exactly the thing being checked.
  const faction = FACTIONS.find((f) => f.key === filter.faction)

  /*
   * The realm leads and never takes a preposition.
   *
   * "founders on France" was fine and "founders on United States" was not, and
   * no single preposition fixes both — half the country names in this dataset
   * want a definite article and the runtime does not say which. Putting the
   * realm in front, separated, sidesteps the grammar entirely and reads like
   * what the page actually is: a realm, then who is on it.
   */
  const who: string[] = []
  if (faction) who.push(faction.key)
  who.push(filter.characterClass ? `${filter.characterClass}s` : 'founders')
  const subject = who.join(' ')
  const realm = filter.realm ? realmLabel(filter.realm) : null
  const named = [realm, subject].filter(Boolean).join(' — ')

  const plain = filter.characterClass || filter.realm || faction
  // Prose needs a preposition after all, and "on the X realm" is the one
  // construction that survives every country name in the list.
  const sentence = realm ? `${subject} on the ${realm} realm` : subject

  return {
    title: plain ? `The ladder — ${named}` : 'The ladder',
    heading: plain ? named.toUpperCase() : 'THE LADDER',
    description: plain
      ? `The highest-levelled indie ${sentence}, ranked by lifetime revenue and current MRR.`
      : 'The hundred highest-levelled indie founders, ranked by lifetime revenue and current MRR. Filter by class, faction or realm.',
    canonical: href(search, {}),
    filtered: Boolean(plain),
  }
}
