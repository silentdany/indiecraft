import type { Metadata } from 'next'
import Link from 'next/link'
import { Frame } from '@/components/frame'
import { ACHIEVEMENT_ICONS } from '@/components/icon'
import { WowIcon } from '@/components/wow-icon'
import {
  ACHIEVEMENTS,
  CLASS_COLORS,
  CLASS_ICONS,
  FACTIONS,
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  RARITY_BANDS,
} from '@/engine'
import { CLASS_RULES, XP_PER_PRODUCT } from '@/engine/tuning'
import { getClassCounts, getFactionCounts, getRealmCounts } from '@/lib/queries'
import { realmLabel } from '@/lib/realm'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'The rules',
  description:
    'Every number on this site, and how it is worked out. The level table, the class tree, the rarity bands and all fifteen achievements.',
  alternates: { canonical: '/rules' },
}

/**
 * The formula, on the site rather than only in the repo.
 *
 * The armory tells people it crawled their numbers and gave them a class. The
 * answer to "says who?" was a link to GitHub, which is an answer for developers
 * and a shrug for everyone else. Every table below is rendered straight from
 * engine/tuning.ts, so it cannot drift from the code that produced the sheet —
 * a rebalance ships the explanation with it or not at all.
 */
export default async function Rules() {
  const [counts, factionCounts, realmCounts] = await Promise.all([
    getClassCounts().catch(() => []),
    getFactionCounts().catch(() => []),
    getRealmCounts().catch(() => []),
  ])
  const share = new Map(counts.map((c) => [c.name, c.count]))
  const total = counts.reduce((sum, c) => sum + c.count, 0)
  const factionShare = new Map(factionCounts.map((f) => [f.value, f.count]))
  const placed = realmCounts.reduce((sum, r) => sum + r.count, 0)

  return (
    <main className="page">
      <header className="page-head">
        <h1 className="serif gold">THE RULES</h1>
        <p className="muted">
          Every number on a character sheet comes from the tables below, and the tables come
          straight from the source file that produces them. Nothing here is rounded for effect.
        </p>
      </header>

      <Frame className="rules-formula">
        <code>
          XP = lifetime revenue in dollars + {XP_PER_PRODUCT} per product shipped
          <br />
          level = the last tier reached in the table below
          <br />
          iLvl = the average item level of the gear you are wearing
        </code>
        <p className="muted">
          Level is what you have banked and cannot lose. Item level is what you are carrying right
          now: every stat on your sheet is an equipment slot, each piece scores from where that stat
          sits on its own ladder, and your iLvl is their mean — which is exactly how the game
          computes it. A slot TrustMRR never filled is left out of the average rather than counted
          as a zero, because no data is not a bad score.
        </p>
      </Frame>

      <Section title={`The level table — ${MAX_LEVEL} tiers`}>
        <p className="muted rules-note">
          A table, not a formula: hand-tunable, explainable in one screenshot, and it lets level 1
          be free without putting level {MAX_LEVEL} out of reach. Going from 40 to 41 costs
          proportionally what 10 to 11 did.
        </p>
        <ol className="levels">
          {LEVEL_THRESHOLDS.map((xp, i) => {
            const level = i + 1
            const band = RARITY_BANDS.find((b) => level >= b.minLevel)
            return (
              <li key={level} className="level-cell">
                <span className="serif level-cell-n" style={{ color: band?.rarity.hex }}>
                  {level}
                </span>
                <span className="level-cell-xp">{compact(xp)}</span>
              </li>
            )
          })}
        </ol>
      </Section>

      <Section title="Rarity">
        <p className="muted rules-note">
          Indexed on level. A purple border reads without a single word, which is the whole reason
          it is there.
        </p>
        <ul className="bands">
          {[...RARITY_BANDS].reverse().map((band, i, all) => {
            // Bands are stored highest-first and carry only a floor, so a band's
            // ceiling is the next floor minus one — and the top band's is the cap.
            const next = all[i + 1]
            const upper = next ? next.minLevel - 1 : MAX_LEVEL
            return (
              <li key={band.rarity.name} className="band">
                <span className="qsquare band-chip" style={{ color: band.rarity.hex }} />
                <span className="band-name" style={{ color: band.rarity.hex }}>
                  {band.rarity.name}
                </span>
                <span className="label">
                  level {band.minLevel}
                  {upper > band.minLevel ? `–${upper}` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      </Section>

      <Section title="The class tree">
        <p className="muted rules-note">
          Deterministic, first match wins, and the order is the point: how you build and how you
          find customers are choices, so they are read first. The size and price of the business
          follow from them. Percentages are what the corpus actually looks like right now, not an
          estimate.
        </p>
        <ol className="rules-classes">
          {CLASS_RULES.map((rule, i) => {
            const n = share.get(rule.class)
            return (
              <li key={rule.class} className="rules-class">
                <span className="rules-class-n label">{i + 1}</span>
                <span
                  className="qsquare rules-class-icon"
                  style={{ color: CLASS_COLORS[rule.class] }}
                >
                  <WowIcon slug={CLASS_ICONS[rule.class]} glyph={rule.class} size={22} bare />
                </span>
                <span className="rules-class-body">
                  <span className="rules-class-head">
                    <span className="serif" style={{ color: CLASS_COLORS[rule.class] }}>
                      {rule.class}
                    </span>
                    {n !== undefined && total > 0 && (
                      <span className="label">
                        {n} · {Math.round((n / total) * 100)}%
                      </span>
                    )}
                  </span>
                  <span className="rules-class-cond">{rule.condition}</span>
                  <span className="muted rules-class-reason">{rule.reason}</span>
                </span>
              </li>
            )
          })}
        </ol>
        <p className="muted rules-note">
          Anyone still earning falls through to Evoker, so Adventurer means one thing only: shipped,
          and nothing coming in yet. It is never a verdict — every founder here has launched
          something, which most people never do. The colours are the canonical ones, not ours: a
          class is a colour before it is a word, and there is no point inventing a vocabulary that
          millions of people already read fluently.
        </p>
      </Section>

      <Section title="Factions and realms">
        <p className="muted rules-note">
          Neither is computed. Both are read straight off the listing — who a founder sells to, and
          where the business is registered — and both are the commonest answer across their
          products, because somebody with three B2B tools and one consumer app is a B2B founder.
          Where TrustMRR never said, the sheet says nothing rather than guessing.
        </p>

        <ul className="bands">
          {FACTIONS.map((f) => {
            const n = factionShare.get(f.key)
            return (
              <li key={f.key} className="band">
                <span className="qsquare band-chip" style={{ color: f.color }}>
                  <WowIcon slug={f.icon} glyph={f.key} size={20} bare />
                </span>
                <span className="band-name" style={{ color: f.color }}>
                  {f.key}
                </span>
                <span className="label">
                  {f.tagline}
                  {n === undefined ? '' : ` · ${n}`}
                </span>
              </li>
            )
          })}
        </ul>

        <p className="muted rules-note">
          Business type is the only field in the whole payload that splits the corpus down the
          middle, which is why it became a faction rather than another line of metadata. It is also
          the fact that changes how every other number reads: $200 a month is a bargain from one
          side of that line and a fortune from the other.
        </p>

        {realmCounts.length > 0 && (
          <>
            <p className="muted rules-note">
              {realmCounts.length} realms hold {placed} characters. The global ladder is, in
              practice, the American one — so the realm you stand on is the ladder most founders can
              actually place in.
            </p>
            <ul className="realm-grid">
              {realmCounts.map((r) => (
                <li key={r.value}>
                  <Link href={`/ladder?realm=${r.value}`} className="realm-chip">
                    <span className="serif">{r.value}</span>
                    <span className="realm-chip-name">{realmLabel(r.value)}</span>
                    <span className="label">{r.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title={`Achievements — ${ACHIEVEMENTS.length}`}>
        <p className="muted rules-note">
          All retroactive, all phrased as something gained. Once earned they are never taken back,
          even if the condition stops being true.
        </p>
        <ul className="ach">
          {ACHIEVEMENTS.map((def) => (
            <li key={def.code} className="ach-card">
              <span className="qsquare ach-icon">
                <WowIcon
                  slug={def.icon}
                  glyph={ACHIEVEMENT_ICONS[def.code] ?? 'achievement'}
                  size={30}
                />
              </span>
              <span className="ach-body">
                <span className="ach-title serif">{def.label}</span>
                <span className="ach-desc">{def.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <p className="rules-outro">
        Disagree with any of it? <a href={TUNING_URL}>One file</a> holds the whole thing, and
        rebalancing pull requests are the kind we want. <Link href="/ladder">See the ladder</Link>.
      </p>
    </main>
  )
}

const TUNING_URL = 'https://github.com/silentdany/indiecraft/blob/main/engine/tuning.ts'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rules-section">
      <h2
        className="serif"
        id={title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')}
      >
        {title.toUpperCase()}
      </h2>
      {children}
    </section>
  )
}

/** $1.25M beats $1,250,000 in a sixty-cell grid. */
function compact(xp: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: xp >= 1_000 ? 2 : 0,
  }).format(xp)
}
