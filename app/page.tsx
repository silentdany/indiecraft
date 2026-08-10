import Link from 'next/link'
import type { CSSProperties } from 'react'
import { BrandMark } from '@/components/brand-mark'
import { Frame } from '@/components/frame'
import { Icon, type IconName } from '@/components/icon'
import { InspectSearch } from '@/components/inspect-search'
import { JsonLd } from '@/components/json-ld'
import { LadderTable } from '@/components/ladder-table'
import { CLASS_COLORS, FACTIONS_BY_KEY } from '@/engine'
import type { CharacterClass } from '@/engine/types'
import {
  getClassCounts,
  getFactionCounts,
  getLadder,
  getRealmCounts,
  getRealmStats,
} from '@/lib/queries'
import { realmLabel } from '@/lib/realm'

export const revalidate = 300

/**
 * The armory front.
 *
 * Deliberately not a marketing page: no hero paragraph, no feature grid, no
 * testimonial. WoW's own front door is a character list and a search box, and
 * the product here IS the ladder — so the ladder is the page. Anyone who wants
 * the rules can read them in the repo, which is linked once and never
 * explained.
 *
 * The order is one question per band, answered before the next is asked:
 *
 *   1. who are you        — the crest and the inspect box
 *   2. how big is this    — five figures across the realm strip
 *   3. who sells to whom  — the three factions, the coarsest cut there is
 *   4. who is winning     — the top of the ladder
 *   5. where do you fit   — classes and realms, the two ladders somebody who
 *                           will never be in the global top can place in
 *
 * Twenty rows of ladder used to sit at (4) and the answers to (5) were beneath
 * them, which is precisely backwards: the top of a ladder is its least
 * differentiated part — the first nine rows are all level 60 — so it was
 * spending four hundred pixels saying one thing, and burying the two sections
 * that exist for people who are not on it. Ten rows now, and the whole ladder
 * is one link away from the heading above them.
 *
 * The class tabs moved out of the ladder section for a different reason. They
 * sat between its heading and its rows, in the same tab styling the ladder page
 * uses for its live facets, so they read as filtering the twenty rows below
 * them. They never did — every one of them navigates away.
 */
export default async function Home() {
  const [ladder, stats, classes, factions, realms] = await Promise.all([
    getLadder().catch(() => null),
    getRealmStats().catch(() => null),
    getClassCounts().catch(() => []),
    getFactionCounts().catch(() => []),
    getRealmCounts().catch(() => []),
  ])

  const rows = ladder?.rows ?? []

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  return (
    <main className="page">
      {/* The inspect box, declared so search engines can offer it directly. */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'World of Indiecraft',
          url: site,
          description:
            'A public armory for indie founders. Lifetime revenue is XP, MRR is item level, products are gear.',
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: `${site}/c/{handle}` },
            'query-input': 'required name=handle',
          },
        }}
      />

      <Frame className="hero">
        <BrandMark size={64} className="wordmark-crest" />
        <p className="wordmark-over label">World of</p>
        <h1 className="wordmark serif">INDIECRAFT</h1>
        <p className="wordmark-under label">The founders&rsquo; armory</p>

        <InspectSearch />

        <p className="hero-note muted">
          Lifetime revenue is XP. MRR is item level. Your products are your gear.
        </p>
      </Frame>

      {stats && stats.characters > 0 && (
        <section className="realm" aria-label="Realm status">
          <Stat
            icon="characters"
            label="Characters"
            value={stats.characters.toLocaleString('en-US')}
          />
          <Stat icon="level" label="Highest level" value={String(stats.maxLevel)} />
          <Stat icon="revenue" label="Tracked MRR" value={compactUsd(stats.trackedMrrUsd)} />
          <Stat icon="gear" label="Gear" value={stats.products.toLocaleString('en-US')} />
          <Stat
            icon="achievement"
            label="Achievements"
            value={stats.achievements.toLocaleString('en-US')}
          />
        </section>
      )}

      {/* Three of them, splitting the whole corpus, so they get a band of their
          own rather than a column: as one of two columns the list was three
          cards tall next to ten realms and left two hundred pixels of nothing
          under it.

          Headed like every other section, because a bare row of three cards
          reading "B2C / B2B / Both" does not say what it is a division of, and
          on a site that calls countries realms it will not be guessed. */}
      {factions.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <header className="section-head">
            <h2 className="serif">FACTIONS</h2>
            <span className="label">Who they sell to</span>
          </header>

          <div className="factionband">
            {factions.map((f) => {
              const def = FACTIONS_BY_KEY.get(f.value)
              if (!def) return null
              return (
                <Link
                  key={f.value}
                  href={`/ladder?faction=${f.value}`}
                  className="faction-card"
                  style={{ '--faction-color': def.color } as React.CSSProperties}
                >
                  <span className="qsquare faction-icon">
                    <Icon name={def.key} size={20} />
                  </span>
                  <span className="faction-body">
                    <span className="serif faction-name">{def.key}</span>
                    <span className="label">{def.tagline}</span>
                  </span>
                  <span className="serif faction-count">{f.count}</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <section style={{ marginTop: 30 }}>
        <header className="section-head">
          <h2 className="serif">THE LADDER</h2>
          {/* Says the number, because "Full top 100" was a link that named a
              limit the ladder no longer has, and nobody clicks through to find
              a bigger list than the one they were promised. Ten rows here,
              everybody through the link. */}
          <Link href="/ladder" className="label">
            {ladder ? `All ${ladder.total.toLocaleString('en-US')} founders →` : 'The ladder →'}
          </Link>
        </header>

        <LadderTable rows={rows.slice(0, 10)} />
      </section>

      {/*
        Two ways into the ladder that are not "be in the global top hundred".
        A quarter of the corpus sits on one realm, so the global list is, in
        practice, the American list — and a French founder who will never appear
        on it has no reason to come back. A realm of seventy-eight is a ladder
        they can actually place in, and so is a class of nine.

        Eleven classes against ten realms, which is why they are the pair: two
        columns of the same height, each a plain list of the same shape.
      */}
      {(classes.length > 0 || realms.length > 0) && (
        <section className="worlds">
          {classes.length > 0 && (
            <div className="worlds-col">
              <header className="section-head">
                <h2 className="serif">CLASSES</h2>
                <Link href="/rules#the-class-tree" className="label">
                  How they are decided →
                </Link>
              </header>
              <ul className="realm-list">
                {classes.map((c) => (
                  <li key={c.name}>
                    <Link
                      href={`/ladder?class=${encodeURIComponent(c.name)}`}
                      className="realm-row"
                      style={
                        { '--row-color': CLASS_COLORS[c.name as CharacterClass] } as CSSProperties
                      }
                    >
                      <span className="qsquare realm-code class-mark">
                        <Icon name={c.name as CharacterClass} size={15} />
                      </span>
                      <span className="realm-name class-name">{c.name}</span>
                      <span className="realm-count label">{c.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {realms.length > 0 && (
            <div className="worlds-col">
              <header className="section-head">
                <h2 className="serif">REALMS</h2>
                <Link href="/ladder" className="label">
                  All realms →
                </Link>
              </header>
              <ul className="realm-list">
                {realms.slice(0, 11).map((r) => (
                  <li key={r.value}>
                    <Link href={`/ladder?realm=${r.value}`} className="realm-row">
                      <span className="qsquare realm-code serif">{r.value}</span>
                      <span className="realm-name">{realmLabel(r.value)}</span>
                      <span className="realm-count label">{r.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

/*
 * The reference pairs every stat with a glyph in a bordered square, the value
 * in the stat's own colour and the name in bold uppercase beneath. That pairing
 * is most of why its numbers read as a readout rather than a table, and it cost
 * us nothing to adopt — the drawings are ours.
 */
function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="realm-cell">
      <span className="qsquare realm-icon">
        <Icon name={icon} size={18} />
      </span>
      <span className="realm-figures">
        <span className="serif">{value}</span>
        <span className="stat-name">{label}</span>
      </span>
    </div>
  )
}

/** $2.1M reads at a glance; $2,134,908 does not. */
function compactUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}
