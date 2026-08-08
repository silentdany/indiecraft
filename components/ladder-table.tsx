import Link from 'next/link'
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
            <span
              className="ladder-level serif"
              style={{ borderColor: row.rarity.hex, color: row.rarity.hex }}
            >
              {row.level}
            </span>
            <span className="ladder-name" style={{ color: row.rarity.hex }}>
              @{row.handle}
            </span>
            <span className="ladder-class label">{row.characterClass}</span>
            <span className="ladder-ilvl label">iLvl {row.ilvl}</span>
          </Link>
        </li>
      ))}
    </ol>
  )
}
