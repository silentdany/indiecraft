import Link from 'next/link'
import { ACHIEVEMENT_ICONS, Icon, type IconName } from '@/components/icon'
import { ACHIEVEMENTS } from '@/engine'
import type { AchievementProgressInput } from '@/engine/types'
import type { HistoryPoint, RankContext, SheetStats } from '@/lib/queries'

/**
 * The three panels that turned the sheet from a readout into something with
 * depth: what the rank means, what the numbers are, and what is left to earn.
 */

/**
 * A bare "#14" is inert. A position inside a class is something a person can
 * hold and defend, and the founder immediately above is a target rather than a
 * statistic — which is also why both neighbours are links.
 */
export function RankPanel({
  context,
  characterClass,
  mrrUsd,
}: {
  context: RankContext
  characterClass: string
  mrrUsd: number
}) {
  const gap = context.above ? context.above.mrrUsd - mrrUsd : 0

  return (
    <div className="rankpanel">
      <div className="rankpanel-figures">
        <Figure value={`#${context.rank}`} label={`of ${context.total}`} />
        <Figure
          value={`#${context.classRank}`}
          label={`of ${context.classTotal} ${characterClass}`}
        />
        <Figure value={`top ${context.percentile}%`} label="overall" />
      </div>

      {(context.above || context.below) && (
        <div className="rivals">
          {context.above && (
            <Link href={`/c/${context.above.handle}`} className="rival">
              <span className="label">Above</span>
              <span className="rival-name">@{context.above.handle}</span>
              {gap > 0 && <span className="rival-gap">{usdCompact(gap)} MRR ahead</span>}
            </Link>
          )}
          {context.below && (
            <Link href={`/c/${context.below.handle}`} className="rival">
              <span className="label">Below</span>
              <span className="rival-name">@{context.below.handle}</span>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="rankfig">
      <span className="serif">{value}</span>
      <span className="label">{label}</span>
    </div>
  )
}

/**
 * The stat panel the reference armory reads as: a glyph, a value in the stat's
 * colour, a name underneath. Only the stats we actually have — a panel padded
 * with dashes says less than a shorter one.
 */
type StatCell = { icon: IconName; v: string; l: string }

export function StatsPanel({ stats }: { stats: SheetStats }) {
  // Built by pushing rather than by filtering a list of `false`s: the union of
  // literal types a conditional array produces is not worth the type predicate
  // needed to narrow it back.
  const cells: StatCell[] = []
  const add = (icon: IconName, v: string | null, l: string) => {
    if (v !== null) cells.push({ icon, v, l })
  }

  add('revenue', stats.last30dUsd > 0 ? usdCompact(stats.last30dUsd) : null, 'Last 30 days')
  add('coins', stats.arpu === null ? null : usd(stats.arpu), 'Per customer')
  add('crowd', stats.customers === null ? null : num(stats.customers), 'Customers')
  add(
    'shieldPulse',
    stats.retention === null ? null : `${Math.round(stats.retention * 100)}%`,
    'Retention',
  )
  add(
    'rising',
    stats.growthMrr30d === null
      ? null
      : `${stats.growthMrr30d > 0 ? '+' : ''}${stats.growthMrr30d.toFixed(1)}%`,
    'Growth 30d',
  )
  add('beacon', stats.domainRating === null ? null : String(stats.domainRating), 'Domain rating')
  add('banner', stats.followers === null ? null : num(stats.followers), 'Followers')
  add('hourglass', stats.age === null ? null : `${stats.age.toFixed(1)}y`, 'Shipping for')

  if (cells.length === 0) return null

  return (
    <div className="statgrid">
      {cells.map((c) => (
        <div key={c.l} className="statcell">
          <span className="qsquare statcell-icon">
            <Icon name={c.icon} size={17} />
          </span>
          <span className="statcell-body">
            <span className="serif">{c.v}</span>
            <span className="stat-name">{c.l}</span>
          </span>
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

  return (
    <>
      <p className="ach-locked-head label">Still to earn</p>
      <ul className="ach ach-locked">
        {withProgress.map(({ def, p, ratio }) => (
          <li key={def.code} className="ach-card">
            <span className="qsquare ach-icon">
              <Icon name={ACHIEVEMENT_ICONS[def.code] ?? 'achievement'} size={17} />
            </span>
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
    </>
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
        <Icon name="hourglass" size={15} />
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

const formatDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
