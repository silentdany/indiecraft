import Link from 'next/link'
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

      <section style={{ marginTop: 26 }}>
        <header className="section-head">
          <h2 className="serif">THE LADDER</h2>
          {/* Says the number, because "Full top 100" was a link that named a
              limit the ladder no longer has, and nobody clicks through to find
              a bigger list than the one they were promised. Twenty rows here,
              everybody through the link. */}
          <Link href="/ladder" className="label">
            {ladder ? `All ${ladder.total.toLocaleString('en-US')} founders →` : 'The ladder →'}
          </Link>
        </header>

        {classes.length > 0 && (
          <nav className="tabs" aria-label="Filter by class">
            {classes.map((c) => (
              <Link
                key={c.name}
                href={`/ladder?class=${encodeURIComponent(c.name)}`}
                className="tab"
                style={
                  { '--tab-color': CLASS_COLORS[c.name as CharacterClass] } as React.CSSProperties
                }
              >
                <Icon name={c.name as CharacterClass} size={13} />
                {c.name} <span className="tab-count">{c.count}</span>
              </Link>
            ))}
          </nav>
        )}

        <LadderTable rows={rows.slice(0, 20)} />
      </section>

      {/*
        Two ways into the ladder that are not "be in the global top hundred".
        Eighty of a hundred and thirty-nine characters sit on one realm, so the
        global list is, in practice, the American list — and a French founder
        who will never appear on it has no reason to come back. A realm of
        fourteen is a ladder they can actually place in.
      */}
      {(factions.length > 0 || realms.length > 0) && (
        <section className="worlds">
          {factions.length > 0 && (
            <div className="worlds-col">
              <header className="section-head">
                <h2 className="serif">FACTIONS</h2>
                <span className="label">Who they sell to</span>
              </header>
              <ul className="faction-list">
                {factions.map((f) => {
                  const def = FACTIONS_BY_KEY.get(f.value)
                  if (!def) return null
                  return (
                    <li key={f.value}>
                      <Link
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
                    </li>
                  )
                })}
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
                {realms.slice(0, 10).map((r) => (
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
