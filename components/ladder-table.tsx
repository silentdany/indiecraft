import Link from 'next/link'
import { Icon } from '@/components/icon'
import type { LadderRow } from '@/lib/queries'

/**
 * The ladder itself, shared by the armory front and /ladder.
 *
 * The level sits in a bordered box in its rarity colour — the same treatment
 * the portrait gets on a character sheet. Colour carries the hierarchy, so no
 * row needs a word explaining why it is above another.
 */
export function LadderTable({ rows }: { rows: LadderRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="muted" style={{ padding: '18px 12px', margin: 0 }}>
        The realm is quiet. Characters appear after the nightly crawl.
      </p>
    )
  }

  return (
    <ol className="ladder">
      {rows.map((row) => (
        <li key={row.handle}>
          <Link href={`/c/${row.handle}`}>
            <span className="ladder-rank serif">{row.rank}</span>
            <span className="qsquare ladder-level serif" style={{ color: row.rarity.hex }}>
              {row.level}
            </span>
            <span className="ladder-name" style={{ color: row.rarity.hex }}>
              @{row.handle}
            </span>
            <span className="ladder-class label">
              <Icon name={row.characterClass} size={14} />
              {row.characterClass}
            </span>
            {/*
              The iLvl carries its own quality colour, and it is the one that
              works here. Level rarity paints the entire top 20 orange and the
              whole top 100 in two colours, so the system that exists to give
              instant hierarchy gives none exactly where the ladder is read.
              iLvl spreads the same five colours across the same rows.
            */}
            <span className="ladder-ilvl label">
              {row.ilvl === null ? (
                <span className="ladder-ilvl-none" title="No recurring revenue to score">
                  —
                </span>
              ) : (
                <>
                  iLvl{' '}
                  <span className="ladder-ilvl-value" style={{ color: row.ilvlRarity?.hex }}>
                    {row.ilvl}
                  </span>
                </>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  )
}
