import type { Metadata } from 'next'
import Link from 'next/link'
import { WowIcon } from '@/components/wow-icon'
import {
  CLASS_COLORS,
  CLASS_ICONS,
  rarityFor,
  seasonBoard,
  seasonWindowBefore,
  seasonWindowById,
  seasonWindowOn,
} from '@/engine'
import { getRealmCounts, getSeasonPeers } from '@/lib/queries'
import { normalizeRealm, realmLabel } from '@/lib/realm'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'The season',
  description:
    'Realm standings for the current season, ordered by recent revenue. Lifetime revenue ranks the ladder. This board does not.',
  alternates: { canonical: '/season' },
}

type Search = { realm?: string; season?: string }

/**
 * The season board.
 *
 * Not the ladder. The ladder is lifetime level. This page asks `seasonBoard`
 * to order one realm by the monthly revenue recorded inside one window, and
 * prints that order. A founder with no realm is not given a pool to land in.
 */
export default async function SeasonPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams
  const today = new Date().toISOString().slice(0, 10)
  const current = seasonWindowOn(today)
  const window = (search.season ? seasonWindowById(search.season) : null) ?? current
  const previous = seasonWindowBefore(window)
  const realm = normalizeRealm(search.realm ?? null)
  const [realms, peers] = await Promise.all([
    getRealmCounts().catch(() => []),
    realm ? getSeasonPeers(realm, window.startsOn, window.endsOn) : Promise.resolve([]),
  ])
  const board = realm ? seasonBoard(peers, window, realm) : null
  const viewingCurrent = window.id === current.id

  return (
    <main className="page">
      <header className="page-head">
        <h1 className="serif gold">THE SEASON</h1>
        <p className="muted">
          One realm, one window. Ordered by the latest monthly revenue recorded inside it. Lifetime
          revenue ranks <Link href="/ladder">the ladder</Link>, and it does not rank this.
        </p>
      </header>

      <nav className="tabs season-realms" aria-label="Realms">
        {realms.map((entry) => (
          <Link
            key={entry.value}
            href={href(entry.value, viewingCurrent ? null : window.id)}
            className="tab"
            aria-current={entry.value === realm ? 'page' : undefined}
          >
            {entry.value}
            <span className="tab-count">{entry.count}</span>
          </Link>
        ))}
      </nav>

      {realm && board ? (
        <>
          <div className="section-head">
            <h2 className="serif" style={{ fontSize: 16, letterSpacing: '0.12em', margin: 0 }}>
              {realmLabel(realm)} · {window.startsOn} to {window.endsOn}
            </h2>
            <span className="label">{board.rows.length} on this realm</span>
          </div>
          <p className="muted season-switch">
            {viewingCurrent ? (
              <Link href={href(realm, previous.id)}>Previous season, {previous.startsOn}</Link>
            ) : (
              <Link href={href(realm, null)}>Current season, {current.startsOn}</Link>
            )}
          </p>
          {board.rows.length === 0 ? (
            <p className="muted">Nobody on this realm yet.</p>
          ) : (
            <ol className="ladder">
              {board.rows.map((row) => (
                <li key={row.handle} className="ladder-row">
                  <Link href={`/c/${row.handle}`} className="ladder-main">
                    <span className="ladder-rank serif">{row.rank}</span>
                    <span
                      className="qsquare ladder-level serif"
                      style={{ color: rarityFor(row.level).hex }}
                    >
                      {row.level}
                    </span>
                    <span className="ladder-name" style={{ color: rarityFor(row.level).hex }}>
                      @{row.handle}
                    </span>
                    <span
                      className="ladder-class label"
                      style={{ color: CLASS_COLORS[row.characterClass] }}
                    >
                      <WowIcon
                        slug={CLASS_ICONS[row.characterClass]}
                        glyph={row.characterClass}
                        size={18}
                        bare
                      />
                      {row.characterClass}
                    </span>
                    <span className="ladder-standing">
                      <span className="ladder-realm serif" title={realmLabel(realm)}>
                        {realm}
                      </span>
                    </span>
                    <span className="ladder-ilvl">
                      <span className="ladder-ilvl-value">{usd(row.scoreUsd)}</span> recent
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <p className="muted season-switch">Pick a realm. A season does not cross them.</p>
      )}
    </main>
  )
}

function href(realm: string, season: string | null): string {
  const params = new URLSearchParams({ realm })
  if (season) params.set('season', season)
  return `/season?${params.toString()}`
}

function usd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(value)
}
