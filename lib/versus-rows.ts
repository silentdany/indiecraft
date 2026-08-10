import type { IconName } from '@/components/icon'
import { ACHIEVEMENTS } from '@/engine'
import type { CharacterPage } from '@/lib/queries'
import { realmLabel } from '@/lib/realm'

/**
 * Which rows a comparison holds, and who is ahead on each.
 *
 * Pure, and shared by the page and by its OG card, because the two disagreeing
 * about who leads would be worse than either being wrong alone — the picture
 * that travels would be contradicted by the page it links to.
 *
 * Two rules keep it from being unkind, and they are the whole design:
 *
 *   Nobody "loses". The higher value is marked; the lower one is simply not
 *   marked. No red, no crosses, no score line reading 6–2.
 *
 *   A row where either side lacks the number is dropped, never marked.
 *   TrustMRR is missing a third of its fields, and "0 customers vs 5,784" is a
 *   fabricated defeat built out of an empty column.
 */

export type Side = 'a' | 'b' | null

export interface VersusRow {
  label: string
  icon: IconName
  a: string
  b: string
  /** Which side is ahead, or null when the row is not a contest. */
  winner: Side
}

export function versusRows(a: CharacterPage, b: CharacterPage): VersusRow[] {
  const rows: VersusRow[] = []

  const compare = (
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

  compare('Level', 'level', (c) => c.level, String)
  compare('Item level', 'gear', (c) => c.ilvl, String)
  // The one row where the smaller number wins, and exactly the sort of thing
  // that stays silently wrong forever if it is not named.
  compare(
    'Rank',
    'crest',
    (c) => c.rank,
    (v) => `#${v}`,
    'lower',
  )
  compare('Lifetime', 'revenue', (c) => c.revenueTotalUsd, usd)
  compare('MRR', 'coins', (c) => (c.mrrUsd > 0 ? c.mrrUsd : null), usd)
  compare('Customers', 'crowd', (c) => c.stats.customers, num)
  compare('Per customer', 'coins', (c) => c.stats.arpu, usd)
  compare(
    'Growth 30d',
    'rising',
    (c) => c.stats.growthMrr30d,
    (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
  )
  compare(
    'Retention',
    'shieldPulse',
    (c) => c.stats.retention,
    (v) => `${Math.round(v * 100)}%`,
  )
  compare('Domain rating', 'beacon', (c) => c.stats.domainRating, String)
  compare('Followers', 'banner', (c) => c.stats.followers, num)
  compare('Products', 'stack', (c) => c.nProducts, String)
  compare(
    'Achievements',
    'achievement',
    (c) => c.achievements.length,
    (v) => `${v} / ${ACHIEVEMENTS.length}`,
  )
  compare(
    'Shipping for',
    'hourglass',
    (c) => c.stats.age,
    (v) => `${v.toFixed(1)}y`,
  )

  // Realm and faction are not contests — nobody is "more French" — so they are
  // stated and never marked.
  if (a.profile.realm && b.profile.realm) {
    rows.push({
      label: 'Realm',
      icon: 'realm',
      a: realmLabel(a.profile.realm),
      b: realmLabel(b.profile.realm),
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
