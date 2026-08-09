import Link from 'next/link'
import { Icon, type IconName } from '@/components/icon'
import { ACHIEVEMENTS, CLASS_COLORS } from '@/engine'
import type { CharacterPage } from '@/lib/queries'
import { realmLabel } from '@/lib/realm'

/**
 * Two sheets, one row per stat, and a winner marked on each row.
 *
 * The rank panel already dangles the founders immediately above and below as
 * rivals and then offers nothing to do about it. This is the thing to do about
 * it — and it is the most shareable page shape there is, because the person who
 * comes out ahead posts it and the person who does not now has a number to
 * beat.
 *
 * Two rules keep it from being unkind, and they are the whole design:
 *
 *   Nobody "loses". The higher value is marked; the lower one is simply not
 *   marked. No red, no crosses, no score line reading 6–2.
 *
 *   A row where one side has no data is dropped, never marked. TrustMRR is
 *   missing a third of its fields, and "0 customers vs 5,784" would be a
 *   fabricated defeat built out of an empty column.
 */

type Side = 'a' | 'b' | null

interface Row {
  label: string
  icon: IconName
  a: string
  b: string
  /** Which side is ahead, or null when the row is not a contest. */
  winner: Side
}

export function Versus({ a, b }: { a: CharacterPage; b: CharacterPage }) {
  return (
    <div className="versus">
      <div className="versus-heads">
        <Head character={a} />
        <div className="versus-vs serif">VS</div>
        <Head character={b} />
      </div>

      <ul className="versus-rows">
        {rowsFor(a, b).map((row) => (
          <li key={row.label} className="versus-row">
            <span className={`versus-value serif${row.winner === 'a' ? ' is-ahead' : ''}`}>
              {row.a}
            </span>
            <span className="versus-label label">
              <Icon name={row.icon} size={14} />
              {row.label}
            </span>
            <span className={`versus-value serif${row.winner === 'b' ? ' is-ahead' : ''}`}>
              {row.b}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Head({ character }: { character: CharacterPage }) {
  return (
    <Link href={`/c/${character.handle}`} className="versus-head">
      <span className="qsquare versus-portrait" style={{ color: character.rarity.hex }}>
        {character.avatarUrl ? (
          // biome-ignore lint/performance/noImgElement: matches the sheet's portrait, which shares no pipeline with next/image.
          <img src={character.avatarUrl} alt="" width={82} height={82} />
        ) : (
          <span className="serif" style={{ fontSize: 30 }}>
            {character.handle.slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>
      <span className="versus-name serif">{character.displayName}</span>
      <span
        className="versus-class label"
        style={{ color: CLASS_COLORS[character.characterClass] }}
      >
        <Icon name={character.characterClass} size={13} />
        {character.characterClass}
      </span>
      <span className="muted versus-handle">@{character.handle}</span>
    </Link>
  )
}

/**
 * Every row worth comparing, in the order the sheet states them.
 *
 * `higher` decides the mark. `lower` exists for rank, where #2 beats #40 — the
 * one place where a smaller number is the better one, and exactly the sort of
 * thing that is silently wrong forever if it is not named.
 */
function rowsFor(a: CharacterPage, b: CharacterPage): Row[] {
  const rows: Row[] = []

  const higher = (
    label: string,
    icon: IconName,
    pick: (c: CharacterPage) => number | null,
    format: (v: number) => string,
    direction: 'higher' | 'lower' = 'higher',
  ) => {
    const va = pick(a)
    const vb = pick(b)
    // A missing value on either side means there is no contest to hold.
    if (va === null || vb === null) return

    const fa = format(va)
    const fb = format(vb)
    /*
     * A tie is either value being equal, OR the two rendering identically.
     *
     * $4,469,483 and $4,471,002 both compact to "$4.5M", and marking one of two
     * identical-looking strings as the winner reads as a rendering bug rather
     * than as a difference of $1,519. If the reader cannot see the gap, there
     * is no gap worth crowning.
     */
    const winner: Side =
      va === vb || fa === fb
        ? null
        : direction === 'higher'
          ? va > vb
            ? 'a'
            : 'b'
          : va < vb
            ? 'a'
            : 'b'
    rows.push({ label, icon, a: fa, b: fb, winner })
  }

  higher('Level', 'level', (c) => c.level, String)
  higher('Item level', 'gear', (c) => c.ilvl, String)
  higher(
    'Rank',
    'crest',
    (c) => c.rank,
    (v) => `#${v}`,
    'lower',
  )
  higher('Lifetime', 'revenue', (c) => c.revenueTotalUsd, usd)
  higher('MRR', 'coins', (c) => (c.mrrUsd > 0 ? c.mrrUsd : null), usd)
  higher('Customers', 'crowd', (c) => c.stats.customers, num)
  higher('Per customer', 'coins', (c) => c.stats.arpu, usd)
  higher(
    'Growth 30d',
    'rising',
    (c) => c.stats.growthMrr30d,
    (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
  )
  higher(
    'Retention',
    'shieldPulse',
    (c) => c.stats.retention,
    (v) => `${Math.round(v * 100)}%`,
  )
  higher('Domain rating', 'beacon', (c) => c.stats.domainRating, String)
  higher('Followers', 'banner', (c) => c.stats.followers, num)
  higher('Products', 'stack', (c) => c.nProducts, String)
  higher(
    'Achievements',
    'achievement',
    (c) => c.achievements.length,
    (v) => `${v} / ${ACHIEVEMENTS.length}`,
  )
  higher(
    'Shipping for',
    'hourglass',
    (c) => c.stats.age,
    (v) => `${v.toFixed(1)}y`,
  )

  // Realm and faction are not contests — nobody is "more French" — so they are
  // stated and never marked.
  const realms = [a.profile.realm, b.profile.realm]
  if (realms[0] && realms[1]) {
    rows.push({
      label: 'Realm',
      icon: 'realm',
      a: realmLabel(realms[0]),
      b: realmLabel(realms[1]),
      winner: null,
    })
  }
  if (a.profile.faction && b.profile.faction) {
    rows.push({
      label: 'Faction',
      icon: 'crest',
      a: a.profile.faction,
      b: b.profile.faction,
      winner: null,
    })
  }

  return rows
}

const num = (v: number) => new Intl.NumberFormat('en-US').format(Math.round(v))

const usd = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: v >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: v >= 10_000 ? 1 : 0,
  }).format(v)
