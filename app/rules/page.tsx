import type { Metadata } from 'next'
import Link from 'next/link'
import { Frame } from '@/components/frame'
import { ACHIEVEMENT_ICONS, Icon } from '@/components/icon'
import { ACHIEVEMENTS, LEVEL_THRESHOLDS, MAX_LEVEL, RARITY_BANDS } from '@/engine'
import { CLASS_RULES, XP_PER_PRODUCT } from '@/engine/tuning'
import { getClassCounts } from '@/lib/queries'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'The rules',
  description:
    'Every number on this site, and how it is worked out. The level table, the class tree, the rarity bands and all fifteen achievements.',
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
  const counts = await getClassCounts().catch(() => [])
  const share = new Map(counts.map((c) => [c.name, c.count]))
  const total = counts.reduce((sum, c) => sum + c.count, 0)

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
          iLvl = the level you would hold on twelve months of your current MRR
        </code>
        <p className="muted">
          The gap between the two is the only genuinely interesting number. Above your level, your
          gear outruns your tier. Below it, you are a veteran in a trough. With no recurring revenue
          there is no iLvl at all — the question has no answer, so the sheet says so rather than
          printing a 1.
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
                <span className="qsquare rules-class-icon">
                  <Icon name={rule.class} size={19} />
                </span>
                <span className="rules-class-body">
                  <span className="rules-class-head">
                    <span className="serif gold">{rule.class}</span>
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
          Anyone the rules cannot describe is an Adventurer. It is the class of insufficient data,
          it is never a verdict, and at one percent of the ladder it is doing its job.
        </p>
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
                <Icon name={ACHIEVEMENT_ICONS[def.code] ?? 'achievement'} size={17} />
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
