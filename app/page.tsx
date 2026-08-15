import Link from 'next/link'
import type { CSSProperties } from 'react'
import { BrandMark } from '@/components/brand-mark'
import { Frame } from '@/components/frame'
import type { IconName } from '@/components/icon'
import { InspectSearch } from '@/components/inspect-search'
import { JsonLd } from '@/components/json-ld'
import { LadderTable } from '@/components/ladder-table'
import { WowIcon } from '@/components/wow-icon'
import { CLASS_COLORS, CLASS_ICONS, FACTIONS_BY_KEY, STAT_ICONS } from '@/engine'
import type { CharacterClass } from '@/engine/types'
import {
  getClassCounts,
  getFactionCounts,
  getLadder,
  getRealmCounts,
  getRealmStats,
} from '@/lib/queries'
import { realmLabel } from '@/lib/realm'

/*
 * A day, not five minutes.
 *
 * Every number on this page comes from `characters`, and that table is written
 * once a night by the compute step and never between. Re-rendering every five
 * minutes re-ran the same queries against the same rows 288 times a day to
 * produce the same bytes — and each render of a sheet is six queries, which is
 * how a handful of visitors exhausted the pooler's client budget and took
 * production down.
 *
 * The window is a backstop, not the freshness mechanism: /api/cron/compute
 * revalidates these paths the moment new data lands, so the day only matters if
 * that call never arrives.
 */
export const revalidate = 86400

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
 *   3. who is winning     — the ladder
 *   4. who sells to whom  — the three factions
 *   5. where do you fit   — classes and realms, the two ladders somebody who
 *                           will never be in the global top can place in
 *
 * Only two things on this page get the frame: the crest and the ladder. It is
 * the device the whole site uses to say "this is the subject" — the character
 * sheet spends it on the character — and spending it here is the difference
 * between a ladder that is on the page and a ladder that is the page. Between
 * them sits nothing but five numbers, so the answer to "who is winning" is
 * above the fold on any real screen.
 *
 * Twelve rows, not twenty. The top of a ladder is its least differentiated
 * part — the first nine are all level 60 — so rows thirteen to twenty were
 * spending the tallest block on the page repeating the first ten. Twelve
 * reaches down into 57 and 56, where the numbers start to move.
 *
 * The class tabs used to sit between the ladder's heading and its rows, in the
 * same tab styling /ladder uses for its live facets, so they read as filtering
 * the rows below them. They never did — every one navigates away. They are a
 * list now, beside the realms.
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
            'A public armory for indie founders. Lifetime revenue is XP, every stat is an equipment slot, and item level is the average of your gear.',
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
        {/* `data-text` feeds the two clipped layers in globals.css that make
            the letters read as cast metal. The real text stays here. */}
        <h1 className="wordmark serif" data-text="INDIECRAFT">
          INDIECRAFT
        </h1>
        <p className="wordmark-under label">The founders&rsquo; armory</p>

        <InspectSearch />

        <p className="hero-note muted">
          Lifetime revenue is XP. Your MRR is a weapon. Item level is what you wear.
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

      {/* The one section that gets the crest's treatment. A heading and a list
          made the ladder a section like any other on a page where it is meant
          to be the reason anybody came. */}
      <Frame className="ladderblock">
        <header className="section-head ladderblock-head">
          <h2 className="serif gold">THE LADDER</h2>
          {/* Says the number, because "Full top 100" was a link that named a
              limit the ladder no longer has, and nobody clicks through to find
              a bigger list than the one they were promised. Twelve rows here,
              everybody through the link. */}
          <Link href="/ladder" className="label">
            {ladder ? `All ${ladder.total.toLocaleString('en-US')} founders →` : 'The ladder →'}
          </Link>
        </header>

        <LadderTable rows={rows.slice(0, 12)} />
      </Frame>

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
                  <WowIcon slug={def.icon} glyph={def.key} size={34} className="faction-icon" />
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
                      <WowIcon
                        slug={CLASS_ICONS[c.name as CharacterClass]}
                        glyph={c.name as CharacterClass}
                        size={22}
                        bare
                        className="class-mark"
                      />
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
      <WowIcon slug={STAT_ICONS[icon] ?? null} glyph={icon} size={34} className="realm-icon" />
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
