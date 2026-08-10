import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ACHIEVEMENT_ICONS, Icon, type IconName } from '@/components/icon'
import { ACHIEVEMENTS, achievementRarityHex, CLASS_COLORS, FACTIONS_BY_KEY } from '@/engine'
import type { AchievementProgressInput, CharacterClass } from '@/engine/types'
import type { HistoryPoint, RankContext, SheetProfile, SheetStats } from '@/lib/queries'
import { realmLabel } from '@/lib/realm'

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
    <div className="rankpanel">
      <div className="rankpanel-figures">
        <Figure value={`#${context.rank}`} label={`of ${context.total}`} />
        <Figure
          value={`#${context.classRank}`}
          label={`of ${context.classTotal} ${characterClass}`}
          href={`/ladder?class=${characterClass}`}
          color={CLASS_COLORS[characterClass]}
        />
        {/* The one figure most founders can actually move. A French founder is
            #97 globally forever and 2nd of 14 at home. */}
        {realm && (
          <Figure
            value={`#${realm.rank}`}
            // A middle dot rather than a preposition: "on France" reads and "on
            // United States" does not, and the label has no room to say "on the
            // United States realm".
            label={`of ${realm.total} · ${realmLabel(realm.realm)}`}
            href={`/ladder?realm=${realm.realm}`}
          />
        )}
        <Figure value={`top ${context.percentile}%`} label="overall" />
        {/* The one figure that can only go up. Rank falls when somebody else
            ships; a peak is never taken away. */}
        {context.best && context.best.rank < context.rank && (
          <Figure value={`#${context.best.rank}`} label={`best · ${shortDay(context.best.day)}`} />
        )}
      </div>

      {/* The rivals were a dead end: two names, and nothing to do about either.
          Each now carries the comparison as a second link, which is the thing
          somebody looking at "the founder immediately above me" actually
          wants. */}
      {(context.above || context.below) && (
        <div className="rivals">
          {context.above && (
            <div className="rival">
              <span className="label">Above</span>
              <Link href={`/c/${context.above.handle}`} className="rival-name">
                @{context.above.handle}
              </Link>
              {gap > 0 && <span className="rival-gap">{usdCompact(gap)} MRR ahead</span>}
              <Link href={`/c/${handle}/vs/${context.above.handle}`} className="rival-vs label">
                Compare
              </Link>
            </div>
          )}
          {context.below && (
            <div className="rival">
              <span className="label">Below</span>
              <Link href={`/c/${context.below.handle}`} className="rival-name">
                @{context.below.handle}
              </Link>
              <Link href={`/c/${handle}/vs/${context.below.handle}`} className="rival-vs label">
                Compare
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** A link when the figure names a ladder you can go and read, a div otherwise. */
function Figure({
  value,
  label,
  href,
  color,
}: {
  value: string
  label: string
  href?: string
  color?: string
}) {
  const body = (
    <>
      <span className="serif" style={color ? { color } : undefined}>
        {value}
      </span>
      <span className="label">{label}</span>
    </>
  )
  return href ? (
    <Link href={href} className="rankfig rankfig-link">
      {body}
    </Link>
  ) : (
    <div className="rankfig">{body}</div>
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

/**
 * Realm and faction: where they build, and who they sell to.
 *
 * These were two grey chips in a metadata line, which is where facts go to be
 * ignored. They are the two things on the sheet that place a founder among
 * other founders rather than on a number line — and both are links, because a
 * fact you can walk into is worth more than a fact you can read.
 *
 * Absent rather than "Unknown": a third of the corpus has no country and a
 * third no business type, and a row of grey question marks would make the sheet
 * look broken on a third of its pages for no information gained.
 */
export function Standing({ profile }: { profile: SheetProfile }) {
  const faction = profile.faction ? FACTIONS_BY_KEY.get(profile.faction) : undefined
  if (!profile.realm && !faction) return null

  return (
    <div className="standing">
      {profile.realm && (
        <Link href={`/ladder?realm=${profile.realm}`} className="standing-cell">
          <span className="qsquare standing-icon">
            <Icon name="realm" size={16} />
          </span>
          <span className="standing-body">
            <span className="label">Realm</span>
            <span className="standing-value serif">{realmLabel(profile.realm)}</span>
          </span>
          <span className="standing-code serif">{profile.realm}</span>
        </Link>
      )}

      {faction && (
        <Link
          href={`/ladder?faction=${faction.key}`}
          className="standing-cell"
          style={{ '--standing-color': faction.color } as React.CSSProperties}
        >
          <span className="qsquare standing-icon standing-icon-faction">
            <Icon name={faction.key} size={16} />
          </span>
          <span className="standing-body">
            <span className="label">Faction</span>
            <span className="standing-value serif">{faction.key}</span>
          </span>
          <span className="standing-tagline label">{faction.tagline}</span>
        </Link>
      )}
    </div>
  )
}

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
          <span className="qsquare timeline-dot">
            <Icon
              name={e.kind === 'level' ? 'level' : e.kind === 'joined' ? 'crest' : 'achievement'}
              size={13}
            />
          </span>
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
