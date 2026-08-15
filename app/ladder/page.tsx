import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ACHIEVEMENT_ICONS } from '@/components/icon'
import { JsonLd } from '@/components/json-ld'
import { LadderTable } from '@/components/ladder-table'
import { WowIcon } from '@/components/wow-icon'
import {
  ACHIEVEMENTS_BY_CODE,
  achievementRarityHex,
  CLASS_COLORS,
  CLASS_ICONS,
  FACTIONS,
  FACTIONS_BY_KEY,
} from '@/engine'
import type { CharacterClass } from '@/engine/types'
import {
  getAchievementCounts,
  getClassCounts,
  getFactionCounts,
  getLadder,
  getRealmCounts,
  LADDER_SORTS,
  type LadderFilter,
  type LadderQuery,
} from '@/lib/queries'
import { normalizeRealm, realmLabel } from '@/lib/realm'

/*
 * This page reads searchParams, so Next renders it dynamically and this number
 * has never done anything — it was quietly decorative while the route ran its
 * queries on every single request. Kept at a real value for the day the page
 * stops being dynamic; the caching that actually applies here is on the
 * queries themselves, in lib/queries.ts.
 */
export const revalidate = 86400

type Search = {
  class?: string
  realm?: string
  faction?: string
  ach?: string
  q?: string
  page?: string
  sort?: string
}

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
    // Every narrowed view is noindex — see `describe`, where the rule and the
    // reason for it live.
    robots: filtered ? { index: false, follow: true } : undefined,
  }
}

export default async function Ladder({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams
  const filter = toFilter(search)

  const [ladder, classes, realms, factions, badges] = await Promise.all([
    getLadder(toQuery(search)),
    getClassCounts(),
    getRealmCounts(),
    getFactionCounts(),
    getAchievementCounts(),
  ])
  const { rows, total, page, perPage, pageCount, sort } = ladder

  /*
   * `?page=999` on a twelve-page ladder is not an error state worth designing.
   * It comes from a stale link or a hand-edited URL, and the honest answer is
   * the last page — which also keeps the pager from having to reason about a
   * "previous" that would be page 998. The total is already in hand, so this
   * costs one redirect and no extra query.
   */
  if (total > 0 && page > pageCount) redirect(href(search, { page: pageStr(pageCount) }))

  /*
   * Every facet currently on, each with the link that removes it.
   *
   * Built here rather than in the markup because the four sources have nothing
   * in common but the shape: a class is its own name, a realm needs looking up,
   * a badge is a code that means nothing until it is resolved, and a search is
   * not a facet at all but reads as one to whoever typed it.
   */
  const active: { key: string; label: string; title?: string; remove: string }[] = []
  if (filter.characterClass) {
    active.push({
      key: 'class',
      label: filter.characterClass,
      remove: href(search, { class: undefined }),
    })
  }
  if (filter.faction) {
    active.push({
      key: 'faction',
      label: filter.faction,
      // By value, like `describe` does: the query string is a string until a
      // definition vouches for it.
      title: FACTIONS.find((f) => f.key === filter.faction)?.tagline,
      remove: href(search, { faction: undefined }),
    })
  }
  if (filter.realm) {
    active.push({
      key: 'realm',
      label: realmLabel(filter.realm),
      remove: href(search, { realm: undefined }),
    })
  }
  if (filter.achievement) {
    const def = ACHIEVEMENTS_BY_CODE.get(filter.achievement)
    active.push({
      key: 'ach',
      label: def?.label ?? filter.achievement,
      title: def?.description,
      remove: href(search, { ach: undefined }),
    })
  }
  if (search.q?.trim()) {
    active.push({
      key: 'q',
      label: `"${search.q.trim()}"`,
      remove: href(search, { q: undefined }),
    })
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const { title, heading, description } = describe(search)
  const q = search.q?.trim() ?? ''

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
        {/* Says what this page is, not what the whole ladder is: "1,155
            founders" above rows 101–200 is a caption for a different page. */}
        <span className="label">{caption({ total, page, perPage, q })}</span>
      </header>

      <div className="facets">
        {/*
          What is currently on, and how to turn it off.
          
          Four tab strips with one chip lit somewhere in each is a puzzle: the
          state of the page was only legible by scanning every row for the
          highlighted item. This says it in one line, and every chip is its own
          undo — which is also the only way to remove one filter without
          hunting for the "All" that belongs to it.
        */}
        {active.length > 0 && (
          <div className="facets-active">
            <span className="facet-label label">On</span>
            <nav className="tabs" aria-label="Active filters">
              {active.map((a) => (
                <Link key={a.key} href={a.remove} className="tab activechip" title={a.title}>
                  {a.label}
                  <span aria-hidden="true">×</span>
                </Link>
              ))}
              <Link href="/ladder" className="tab activeclear">
                Clear all
              </Link>
            </nav>
          </div>
        )}

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
              <WowIcon
                slug={CLASS_ICONS[c.name as CharacterClass]}
                glyph={c.name as CharacterClass}
                size={16}
                bare
              />
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
                <WowIcon slug={def?.icon ?? null} glyph={f.value} size={16} bare />
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
        {/*
          Sort is not a filter and is deliberately last: every facet above
          narrows WHICH founders are on the board, this one changes what their
          rank means. Same tab strip because it is the same gesture, and it has
          no "All" — a ladder is always ordered by something.
        */}
        <div className="facet">
          <span className="facet-label label">Sort</span>
          <nav className="tabs" aria-label="Sort the ladder">
            {LADDER_SORTS.map((s) => (
              <Link
                key={s.key}
                href={href(search, { sort: s.key === 'level' ? undefined : s.key })}
                className="tab"
                aria-current={sort === s.key ? 'page' : undefined}
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </div>

        {/*
          Badges, out of the tab pile and into a grid that says what they are.

          They were thirty-five chips in a fifth strip, twelve visible and the
          rest behind a nested disclosure — a wall of bare names. "Summoned",
          "Companion" and "Dual Spec" mean nothing to somebody who has not read
          the rules page, and a filter you cannot understand is a filter nobody
          uses. Each one now carries the art it already has on every sheet, the
          sentence that defines it, and how many founders hold it.

          Open when a badge is on, shut otherwise: it is the largest control
          here and the least often wanted.
        */}
        {badges.length > 0 && (
          <details className="badgepicker" open={Boolean(filter.achievement)}>
            <summary>
              <span className="facet-label label">Badge</span>
              <span className="label">
                {filter.achievement
                  ? (ACHIEVEMENTS_BY_CODE.get(filter.achievement)?.label ?? 'Badge')
                  : `${badges.length} to filter by`}
              </span>
            </summary>
            <ul className="badgegrid">
              {badges.map((b) => (
                <BadgeCard key={b.value} badge={b} search={search} current={filter.achievement} />
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* A plain GET form, like every facet above it is a plain link: the
          ladder stays usable and shareable without a line of JavaScript, and
          the URL keeps being the whole state of the page. The facets ride along
          as hidden fields so searching narrows the ladder you are looking at
          rather than dropping you back onto the global one. `page` is
          deliberately not carried — a new search starts at the top. */}
      <search className="laddersearch">
        <form action="/ladder" method="get">
          {filter.characterClass && (
            <input type="hidden" name="class" value={filter.characterClass} />
          )}
          {filter.realm && <input type="hidden" name="realm" value={filter.realm} />}
          {filter.faction && <input type="hidden" name="faction" value={filter.faction} />}
          {filter.achievement && <input type="hidden" name="ach" value={filter.achievement} />}
          {sort === 'ilvl' && <input type="hidden" name="sort" value="ilvl" />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Find a founder on this ladder"
            aria-label="Search this ladder by handle or name"
            autoComplete="off"
          />
          <button type="submit" className="label">
            Search
          </button>
          {q && (
            <Link href={href(search, { q: undefined, page: undefined })} className="label">
              Clear
            </Link>
          )}
        </form>
      </search>

      <LadderTable rows={rows} />

      <Pager search={search} page={page} pageCount={pageCount} />
    </main>
  )
}

/**
 * Previous and next, plus the first and last page and the numbers either side
 * of where you are.
 *
 * Not a full run of twelve numbers, and not prev/next alone. Twelve becomes
 * ninety the moment the corpus does, and prev/next alone makes the far end of a
 * long ladder reachable only by clicking eleven times — the two founders most
 * likely to want it being the one at the bottom and the one checking whether
 * they are.
 */
function Pager({ search, page, pageCount }: { search: Search; page: number; pageCount: number }) {
  if (pageCount <= 1) return null

  const around = new Set<number>([1, pageCount, page - 1, page, page + 1])
  const pages = [...around].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b)

  return (
    <nav className="pager" aria-label="Ladder pages">
      {page > 1 ? (
        <Link
          href={href(search, { page: pageStr(page - 1) })}
          className="pager-step label"
          rel="prev"
        >
          ← Previous
        </Link>
      ) : (
        <span className="pager-step pager-off label">← Previous</span>
      )}

      <span className="pager-nums">
        {pages.map((n, i) => (
          <span key={n} className="pager-num-slot">
            {/* A gap in the run is an ellipsis, not a missing link: it tells you
                the numbers either side are not consecutive. */}
            {i > 0 && n - (pages[i - 1] ?? 0) > 1 && <span className="pager-gap">…</span>}
            {n === page ? (
              <span className="pager-num serif" aria-current="page">
                {n}
              </span>
            ) : (
              <Link href={href(search, { page: pageStr(n) })} className="pager-num serif">
                {n}
              </Link>
            )}
          </span>
        ))}
      </span>

      {page < pageCount ? (
        <Link
          href={href(search, { page: pageStr(page + 1) })}
          className="pager-step label"
          rel="next"
        >
          Next →
        </Link>
      ) : (
        <span className="pager-step pager-off label">Next →</span>
      )}
    </nav>
  )
}

/** Page 1 is the bare URL, so it has exactly one address rather than two. */
const pageStr = (n: number): string | undefined => (n <= 1 ? undefined : String(n))

/** Which slice of what, in one line, and grammatical in all four states. */
function caption({
  total,
  page,
  perPage,
  q,
}: {
  total: number
  page: number
  perPage: number
  q: string
}): string {
  const n = (x: number) => x.toLocaleString('en-US')
  if (total === 0) return q ? `Nobody matches “${q}”` : 'Nobody here yet'

  const first = (page - 1) * perPage + 1
  const last = Math.min(page * perPage, total)
  // No range on a single page of results: "1–7 of 7" says nothing "7" does not.
  const slice = total <= perPage ? n(total) : `${n(first)}–${n(last)} of ${n(total)}`
  const matching = q ? ` matching “${q}”` : ''
  return `${slice}${matching} · by level, then iLvl`
}

/** A badge chip, in its own quality colour, named by its label not its code. */
function BadgeCard({
  badge,
  search,
  current,
}: {
  badge: { value: string; count: number }
  search: Search
  current: string | null | undefined
}) {
  const def = ACHIEVEMENTS_BY_CODE.get(badge.value)
  if (!def) return null
  const on = current === badge.value
  return (
    <li
      className={`badgecard ${on ? 'is-on' : ''}`}
      style={{ '--ach-color': achievementRarityHex(def.rarity) } as React.CSSProperties}
    >
      {/* Clicking the one already on turns it off. A selected filter that links
          to itself is a dead control, and every other facet here has an "All"
          to fall back to — this grid does not. */}
      <Link href={href(search, { ach: on ? undefined : badge.value })}>
        <WowIcon slug={def.icon} glyph={ACHIEVEMENT_ICONS[def.code] ?? 'achievement'} size={30} />
        <span className="badgecard-body">
          <span className="badgecard-name serif">{def.label}</span>
          <span className="badgecard-desc">{def.description}</span>
        </span>
        <span className="badgecard-count label">{badge.count}</span>
      </Link>
    </li>
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
  if (next.ach) params.set('ach', next.ach)
  if (next.q?.trim()) params.set('q', next.q.trim())
  // 'level' is the default and stays out of the URL: a canonical that carries a
  // parameter meaning "the way it already was" splits one page into two.
  if (next.sort === 'ilvl') params.set('sort', 'ilvl')
  // Read off the patch and never off `search`: changing a facet changes which
  // ladder this is, and page 7 of the old one is meaningless on the new one.
  // Only the pager passes a page, and it always passes the one it means.
  if (patch.page) params.set('page', patch.page)
  const query = params.toString()
  return query ? `/ladder?${query}` : '/ladder'
}

function toFilter(search: Search): LadderFilter {
  return {
    characterClass: search.class ?? null,
    realm: normalizeRealm(search.realm),
    faction: search.faction ?? null,
    // Validated against the definitions rather than passed through: the value
    // reaches a query, and an unknown code should read as no filter at all.
    achievement: search.ach && ACHIEVEMENTS_BY_CODE.has(search.ach) ? search.ach : null,
  }
}

function toQuery(search: Search): LadderQuery {
  return {
    ...toFilter(search),
    q: search.q ?? null,
    page: pageNum(search.page),
    sort: search.sort === 'ilvl' ? 'ilvl' : 'level',
  }
}

/** A junk `?page=` is page one, not a crash and not an empty ladder. */
function pageNum(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '1', 10)
  return Number.isFinite(n) && n > 0 ? n : 1
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

  // The badge leads the title rather than joining the subject, because it is a
  // different kind of claim: a class is what you are, a badge is what you did.
  const badge = filter.achievement ? ACHIEVEMENTS_BY_CODE.get(filter.achievement) : undefined

  const narrowed = filter.characterClass || filter.realm || faction
  const plain = narrowed || badge
  // Prose needs a preposition after all, and "on the X realm" is the one
  // construction that survives every country name in the list.
  const sentence = realm ? `${subject} on the ${realm} realm` : subject

  const page = pageNum(search.page)
  const q = search.q?.trim() ?? ''
  // The description has to say which ladder this is: the two orderings put
  // different people at the top, and a page that claims to rank by one while
  // showing the other is the kind of thing nobody notices and everybody
  // half-distrusts.
  const ranked =
    search.sort === 'ilvl'
      ? 'the average item level of their gear'
      : 'lifetime revenue and current MRR'
  // A page number belongs in the title or two hundred pages compete for the
  // same one, and a searcher who lands on page 8 should know that is where
  // they are.
  const suffix = page > 1 ? ` — page ${page}` : ''

  // "Legendary — founders" reads as a compound noun nobody uses. When the badge
  // is the only filter it is the whole subject, and `named` would only add the
  // word "founders" to a page that is entirely about founders.
  const withBadge = badge ? (narrowed ? `${badge.label} — ${named}` : badge.label) : named

  return {
    title: (plain ? `The ladder — ${withBadge}` : 'The ladder') + suffix,
    heading: plain ? withBadge.toUpperCase() : 'THE LADDER',
    description: plain
      ? badge
        ? `Indie ${sentence} who earned ${badge.label} — ${badge.description.toLowerCase()} Ranked by ${ranked}.`
        : `Indie ${sentence}, ranked by ${ranked}.`
      : `Every indie founder on TrustMRR, ranked by ${ranked}. Filter by class, faction, realm or badge, or search for a handle.`,
    canonical: href(search, { page: pageStr(page) }),
    /*
     * Narrowed in any way at all: a facet, a search, or a page past the first.
     *
     * The facet half of this was already a consent decision rather than an SEO
     * one, and paging is the same decision at a larger scale. The bare ladder
     * carries the exposure of naming non-consenting founders once and is left
     * exactly as it was — but it used to stop at a hundred, and submitting all
     * twelve pages to be crawled would multiply that by twelve for people who
     * never asked to be listed anywhere. The pages work, they are linked, and
     * anybody can read or share them. They are just not submitted.
     */
    /*
     * A re-sorted ladder counts as narrowed too, and for a reason none of the
     * others have: it is the SAME founders in a different order. Left
     * indexable it would be duplicate content against the bare ladder, with a
     * canonical of its own asking a crawler to keep both.
     */
    filtered: Boolean(plain) || page > 1 || q !== '' || search.sort === 'ilvl',
  }
}
