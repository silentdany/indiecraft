import Link from 'next/link'
import { Icon } from '@/components/icon'
import { CLASS_COLORS, FACTIONS_BY_KEY } from '@/engine'
import type { LadderRow } from '@/lib/queries'
import { realmLabel } from '@/lib/realm'

/**
 * The ladder itself, shared by the armory front and /ladder.
 *
 * Three colour systems run down these rows and they never mean the same thing,
 * which is the only reason three of them can coexist:
 *   - the level square carries rarity, saturated;
 *   - the class name carries its class, soft;
 *   - the iLvl carries rarity again, because gear score is what an armory
 *     compares.
 * Colour does the hierarchy, so no row needs a word explaining why it is above
 * another.
 */
export function LadderTable({ rows }: { rows: LadderRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="muted" style={{ padding: '18px 12px', margin: 0 }}>
        Nobody here yet. Try a wider filter, or come back after tonight&rsquo;s crawl.
      </p>
    )
  }

  return (
    <ol className="ladder">
      {rows.map((row) => {
        const faction = row.faction ? FACTIONS_BY_KEY.get(row.faction) : undefined
        return (
          <li key={row.handle}>
            <Link href={`/c/${row.handle}`}>
              <span className="ladder-rank serif">{row.rank}</span>
              <span className="qsquare ladder-level serif" style={{ color: row.rarity.hex }}>
                {row.level}
              </span>
              <span className="ladder-name" style={{ color: row.rarity.hex }}>
                @{row.handle}
              </span>
              <span
                className="ladder-class label"
                style={{ color: CLASS_COLORS[row.characterClass] }}
              >
                <Icon name={row.characterClass} size={14} />
                {row.characterClass}
              </span>

              {/* Realm and faction as marks, not words: at a hundred rows the
                  code and the sigil are read in a glance and a spelled-out
                  "United States" on eighty of them is noise. The title carries
                  the full name for anyone who needs it. */}
              <span className="ladder-standing">
                {row.realm ? (
                  <span className="ladder-realm serif" title={realmLabel(row.realm)}>
                    {row.realm}
                  </span>
                ) : (
                  <span className="ladder-realm ladder-blank" aria-hidden="true" />
                )}
                {faction ? (
                  <span
                    className="ladder-faction"
                    style={{ color: faction.color }}
                    title={faction.tagline}
                  >
                    <Icon name={faction.key} size={14} />
                  </span>
                ) : (
                  <span className="ladder-faction ladder-blank" aria-hidden="true" />
                )}
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
        )
      })}
    </ol>
  )
}
