import Link from 'next/link'
import { WowIcon } from '@/components/wow-icon'
import type { InstanceProgress, SeasonStanding } from '@/engine'
import { realmLabel } from '@/lib/realm'

/**
 * Dungeon and raid progress, plus the current realm season.
 *
 * Both arrive already evaluated. This component does not decide whether a
 * boss is down or where a season ranks.
 */
export function InstanceJournal({
  instances,
  season,
}: {
  instances: readonly InstanceProgress[]
  season: SeasonStanding | null
}) {
  return (
    <div className="instances">
      {season && (
        <p className="season-stand">
          <Link href={`/season?realm=${season.realm}`}>{realmLabel(season.realm)} season</Link>
          <span className="serif">
            {' '}
            #{season.rank}
            <span className="statrow-of"> of {season.total}</span>
          </span>
        </p>
      )}
      {instances.map((wing) => (
        <article className="instance" key={wing.code}>
          <header className="instance-head">
            <h3 className="serif">
              <WowIcon slug={wing.icon} glyph="achievement" size={22} bare />
              {wing.name}
            </h3>
            <span
              className={`instance-status instance-${wing.cleared ? 'cleared' : wing.locked ? 'locked' : 'open'}`}
            >
              {wing.cleared ? 'Cleared' : wing.locked ? 'Locked' : 'Open'}
            </span>
          </header>
          <p className="muted instance-blurb">{wing.blurb}</p>
          <p className="label instance-gate">
            {wing.kind === 'raid' ? 'Raid' : 'Dungeon'} · level {wing.requiredLevel}
          </p>
          <ol className="boss-list">
            {wing.bosses.map((boss) => (
              <li className="boss" key={boss.code}>
                <span className="boss-name">
                  <WowIcon slug={boss.icon} glyph="achievement" size={18} bare />
                  {boss.name}
                </span>
                <span className="boss-req">{boss.requirement}</span>
                <span className={`boss-state ${boss.down ? 'boss-down' : 'boss-up'}`}>
                  {boss.down ? 'Down' : 'Up'}
                </span>
              </li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  )
}
