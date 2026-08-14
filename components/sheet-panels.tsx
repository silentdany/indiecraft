import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ACHIEVEMENT_ICONS, type IconName } from '@/components/icon'
import { WowIcon } from '@/components/wow-icon'
import { ACHIEVEMENTS, achievementRarityHex, CLASS_COLORS, UI_ICONS } from '@/engine'
import type { AchievementProgressInput, CharacterClass } from '@/engine/types'
import type { HistoryPoint, RankContext, SheetStats } from '@/lib/queries'
import { realmLabel } from '@/lib/realm'

/**
 * The three panels that turned the sheet from a readout into something with
 * depth: what the rank means, what the numbers are, and what is left to earn.
 */

/**
 * A bare "#14" is inert. A position inside a class is something a person can
 * hold and defend, and the founder immediately above is a target rather than a
 * statistic — which is also why both neighbours are links.
 *
 * ---------------------------------------------------------------------------
 * Rebuilt on the same vocabulary as StatsPanel, because it now sits beside it.
 *
 * This was a full-width card: its own border, its own surface, its own padding,
 * a row of 22px gold numerals and two boxed rivals pushed apart by
 * `justify-content: space-between`. All of that was right when it was the only
 * thing in its section. Dropped into a half-width panel it became a card inside
 * a card — a second border six pixels from the first, dead margin under the
 * heading, and five figures wrapping into a ragged block next to a neighbour
 * made of tidy dotted rows.
 *
 * Same groups, same leaders, same tabular figures as the panel it shares a row
 * with. The headline rank has not been demoted by losing its 22px: it is in the
 * identity strip at the top of the page, and printing it large twice was the
 * actual redundancy.
 */
export function RankPanel({
  context,
  characterClass,
  mrrUsd,
  handle,
}: {
  context: RankContext
  characterClass: CharacterClass
  mrrUsd: number
  handle: string
}) {
  const gap = context.above ? context.above.mrrUsd - mrrUsd : 0
  const realm = context.realmRank

  return (
    <div className="statgroups">
      <div className="statgroup">
        <h3 className="statgroup-head">
          <WowIcon slug={UI_ICONS.rank} glyph="crown" size={18} bare />
          Rank
        </h3>
        <dl className="statlist">
          <RankRow label="Overall" value={`#${context.rank}`} of={context.total} />
          <RankRow
            label={characterClass}
            value={`#${context.classRank}`}
            of={context.classTotal}
            href={`/ladder?class=${characterClass}`}
            color={CLASS_COLORS[characterClass]}
          />
          {/* The one figure most founders can actually move. A French founder
              is #97 globally forever and 2nd of 14 at home. */}
          {realm && (
            <RankRow
              label={realmLabel(realm.realm)}
              value={`#${realm.rank}`}
              of={realm.total}
              href={`/ladder?realm=${realm.realm}`}
            />
          )}
          <RankRow label="Percentile" value={`top ${context.percentile}%`} />
          {/* The one figure that can only go up. Rank falls when somebody else
              ships; a peak is never taken away. */}
          {context.best && context.best.rank < context.rank && (
            <RankRow
              label="Best ever"
              value={`#${context.best.rank}`}
              note={shortDay(context.best.day)}
            />
          )}
        </dl>
      </div>

      {/* The rivals were a dead end: two names, and nothing to do about either.
          Each carries the comparison as a second link, which is the thing
          somebody looking at "the founder immediately above me" actually
          wants. */}
      {(context.above || context.below) && (
        <div className="statgroup">
          <h3 className="statgroup-head">
            <WowIcon slug={UI_ICONS.rivals} glyph="characters" size={18} bare />
            Rivals
          </h3>
          <ul className="rivals">
            {context.above && (
              <Rival
                side="Above"
                handle={handle}
                other={context.above.handle}
                note={gap > 0 ? `${usdCompact(gap)} ahead` : null}
              />
            )}
            {context.below && (
              <Rival side="Below" handle={handle} other={context.below.handle} note={null} />
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * One row of the rank list. `of` renders as a muted denominator beside the
 * ordinal — "#3 of 104" — because a position without its field size is a number
 * pretending to be a rank.
 */
function RankRow({
  label,
  value,
  of,
  note,
  href,
  color,
}: {
  label: string
  value: string
  of?: number
  note?: string
  href?: string
  color?: string
}) {
  return (
    <div className="statrow">
      <dt>
        {href ? (
          <Link href={href} style={color ? { color } : undefined}>
            {label}
          </Link>
        ) : (
          label
        )}
      </dt>
      <dd className="serif">
        {value}
        {of !== undefined && <span className="statrow-of"> of {num(of)}</span>}
        {note && <span className="statrow-of"> · {note}</span>}
      </dd>
    </div>
  )
}

function Rival({
  side,
  handle,
  other,
  note,
}: {
  side: string
  handle: string
  other: string
  note: string | null
}) {
  return (
    <li className="rival">
      <span className="rival-side label">{side}</span>
      <Link href={`/c/${other}`} className="rival-name">
        @{other}
      </Link>
      {note && <span className="rival-gap">{note}</span>}
      <Link href={`/c/${handle}/vs/${other}`} className="rival-vs label">
        Compare
      </Link>
    </li>
  )
}

/**
 * The stat panel, in the shape the reference actually uses.
 *
 * classic-armory renders `{{ category }}` then a run of `{{ stat }}: {{ value }}`
 * rows — Base Stats, Melee, Defense, and so on. This was a grid of glyph tiles
 * instead, which looked like an armory panel from a distance and behaved like
 * one of those stat-card rows every SaaS landing page has: eight equal boxes,
 * no grouping, nothing telling you which number to read against which.
 *
 * Grouped, the same eleven numbers answer three separate questions — what comes
 * in, who it comes from, and where it is going — and each group is short enough
 * to read as a unit. The glyph survives on the category, not on every cell,
 * which is also what the reference does.
 *
 * Only the stats we actually have. A panel padded with dashes says less than a
 * short one, and a whole group with nothing in it does not render at all.
 */
type StatRow = { l: string; v: string; hint?: string }
type StatGroup = { icon: IconName; slug: string; title: string; rows: StatRow[] }

export function StatsPanel({
  stats,
  mrrUsd,
  revenueTotalUsd,
  nProducts,
}: {
  stats: SheetStats
  mrrUsd: number
  revenueTotalUsd: number
  nProducts: number
}) {
  const group = (
    icon: IconName,
    slug: string,
    title: string,
    rows: (StatRow | null)[],
  ): StatGroup | null => {
    const kept = rows.filter((r): r is StatRow => r !== null)
    return kept.length === 0 ? null : { icon, slug, title, rows: kept }
  }
  const row = (l: string, v: string | null, hint?: string): StatRow | null =>
    v === null ? null : { l, v, hint }

  const groups = [
    group('revenue', UI_ICONS.statRevenue, 'Revenue', [
      row('Monthly', mrrUsd > 0 ? usdCompact(mrrUsd) : null),
      row('Last 30 days', stats.last30dUsd > 0 ? usdCompact(stats.last30dUsd) : null),
      row('Lifetime', revenueTotalUsd > 0 ? usdCompact(revenueTotalUsd) : null),
      row('Per customer', stats.arpu === null ? null : usd(stats.arpu)),
    ]),
    group('crowd', UI_ICONS.statAudience, 'Audience', [
      row('Customers', stats.customers === null ? null : num(stats.customers)),
      row(
        'Retention',
        stats.retention === null ? null : `${Math.round(stats.retention * 100)}%`,
        // The one number on this panel that is a proxy rather than a
        // measurement, and it says so where somebody can see it.
        'Active subscriptions over customers. TrustMRR reports no churn figure.',
      ),
      row('Followers', stats.followers === null ? null : num(stats.followers)),
      row('Domain rating', stats.domainRating === null ? null : String(stats.domainRating)),
    ]),
    group('rising', UI_ICONS.statTrajectory, 'Trajectory', [
      row(
        'Growth 30d',
        stats.growthMrr30d === null
          ? null
          : `${stats.growthMrr30d > 0 ? '+' : ''}${stats.growthMrr30d.toFixed(1)}%`,
      ),
      row('Shipping for', stats.age === null ? null : `${stats.age.toFixed(1)}y`),
      row('Products', nProducts > 0 ? num(nProducts) : null),
    ]),
  ].filter((g): g is StatGroup => g !== null)

  if (groups.length === 0) return null

  return (
    <div className="statgroups">
      {groups.map((g) => (
        <div key={g.title} className="statgroup">
          <h3 className="statgroup-head">
            <WowIcon slug={g.slug} glyph={g.icon} size={18} bare />
            {g.title}
          </h3>
          <dl className="statlist">
            {g.rows.map((r) => (
              <div key={r.l} className="statrow" title={r.hint}>
                <dt>
                  {r.l}
                  {r.hint && <span aria-hidden="true"> *</span>}
                </dt>
                <dd className="serif">{r.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}

/**
 * Locked achievements, with how close they are.
 *
 * "Centurion — 100 customers" is a wall; "62 of 100" is a checklist. The bar
 * only appears where a bar can be honest: nobody is 60% of the way to having a
 * cofounder, and those definitions carry no progress function on purpose.
 */
export function LockedAchievements({
  earned,
  input,
}: {
  earned: Set<string>
  input: AchievementProgressInput
}) {
  const locked = ACHIEVEMENTS.filter((def) => !earned.has(def.code))
  if (locked.length === 0) return null

  const withProgress = locked.map((def) => {
    const p = def.progress?.(input) ?? null
    const ratio = p && p.target > 0 ? Math.min(p.current / p.target, 1) : null
    return { def, p, ratio }
  })
  // Closest first: the next one to fall is the interesting one.
  withProgress.sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1))

  /*
   * Nine, then the rest behind a disclosure.
   *
   * There are thirty-five achievements now. A founder holding three would meet
   * thirty-two locked cards below their own — a wall that buries the earned
   * ones and reads as a list of failures rather than of things to go and get.
   * Nine is three rows on desktop, and since the list is already sorted by how
   * close each one is, those nine are the ones actually within reach.
   *
   * A <details> and not a button, so the rest are still in the HTML for anybody
   * who wants them, still findable by the browser's own search, and still there
   * with JavaScript off.
   */
  const NEAR = 9
  const near = withProgress.slice(0, NEAR)
  const far = withProgress.slice(NEAR)

  return (
    <>
      <p className="ach-locked-head label">Still to earn</p>
      <LockedList items={near} />
      {far.length > 0 && (
        <details className="ach-more">
          <summary className="label">{far.length} further out</summary>
          <LockedList items={far} />
        </details>
      )}
    </>
  )
}

type LockedItem = {
  def: (typeof ACHIEVEMENTS)[number]
  p: { current: number; target: number } | null
  ratio: number | null
}

function LockedList({ items }: { items: LockedItem[] }) {
  return (
    <ul className="ach ach-locked">
      {items.map(({ def, p, ratio }) => (
        <li
          key={def.code}
          className="ach-card"
          style={{ '--ach-color': achievementRarityHex(def.rarity) } as CSSProperties}
        >
          <WowIcon
            slug={def.icon}
            glyph={ACHIEVEMENT_ICONS[def.code] ?? 'achievement'}
            size={32}
            className="ach-icon"
          />
          <span className="ach-body">
            <span className="ach-title serif">{def.label}</span>
            <span className="ach-desc">{def.description}</span>
            {p && ratio !== null && (
              <span className="ach-progress">
                <span className="bar">
                  <span style={{ width: `${Math.round(ratio * 100)}%` }} />
                </span>
                <span className="label">
                  {fmt(p.current)} / {fmt(p.target)}
                </span>
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The history strip.
 *
 * Two days deep today, and it says so rather than drawing a confident line
 * through two points. This is the one thing on the sheet a clone cannot copy —
 * snapshots accumulate and nobody can backfill them — so it earns its place
 * before it earns its keep.
 */
export function HistoryPanel({ history }: { history: HistoryPoint[] }) {
  if (history.length === 0) return null

  const first = history[0]!
  const last = history[history.length - 1]!
  const delta = last.mrrUsd - first.mrrUsd
  const days = history.length

  return (
    <div className="history">
      <div className="history-line">
        <WowIcon slug={UI_ICONS.watched} glyph="hourglass" size={20} bare />
        <span>
          Watched since <strong>{formatDay(first.day)}</strong>
          {days > 1 ? ` · ${days} daily snapshots` : ' · first snapshot'}
        </span>
      </div>

      {days > 1 && (
        <div className="history-delta">
          <span className={delta >= 0 ? 'positive' : 'muted'}>
            {delta >= 0 ? '+' : '−'}
            {usdCompact(Math.abs(delta))}
          </span>
          <span className="label">MRR since then</span>
        </div>
      )}

      {days >= 3 && <Sparkline points={history.map((h) => h.mrrUsd)} />}
    </div>
  )
}

/** Flat, no axes, no library: the shape is the whole message. */
function Sparkline({ points }: { points: number[] }) {
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const d = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * 100
      const y = 26 - ((v - min) / span) * 24
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox="0 0 100 28" className="spark" preserveAspectRatio="none" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

const fmt = (v: number) =>
  v >= 1000
    ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
    : Math.round(v * 10) / 10

const num = (v: number) => new Intl.NumberFormat('en-US').format(Math.round(v))

const usd = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v)

const usdCompact = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: v >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: v >= 10_000 ? 1 : 0,
  }).format(v)

/** "12 Aug" — enough to place a peak in time without spending a whole label on it. */
const shortDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })

const formatDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

export interface TimelineEvent {
  at: string
  kind: 'joined' | 'level' | 'achievement'
  label: string
}

/**
 * The career so far.
 *
 * Achievements are all retroactive, so the first compute stamps every one of
 * them with the same day. Listing those as events would produce a wall of
 * identical timestamps that says nothing happened — they collapse into the
 * entry line instead, and only what has genuinely happened since gets a row of
 * its own. Thin today by construction, and it fills in on its own.
 */
export function Timeline({ events, backfilled }: { events: TimelineEvent[]; backfilled: number }) {
  if (events.length === 0) return null

  return (
    <ol className="timeline">
      {events.map((e) => (
        <li key={`${e.kind}-${e.at}-${e.label}`} className="timeline-row">
          <WowIcon
            slug={
              e.kind === 'level'
                ? UI_ICONS.timelineLevel
                : e.kind === 'joined'
                  ? UI_ICONS.timelineJoined
                  : UI_ICONS.timelineAchievement
            }
            glyph={e.kind === 'level' ? 'level' : e.kind === 'joined' ? 'crest' : 'achievement'}
            size={24}
            className="timeline-dot"
          />
          <span className="timeline-label">
            {e.label}
            {e.kind === 'joined' && backfilled > 0 && (
              <span className="muted"> with {backfilled} achievements already earned</span>
            )}
          </span>
          <span className="timeline-when label">{formatDay(e.at.slice(0, 10))}</span>
        </li>
      ))}
    </ol>
  )
}
