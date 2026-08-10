import { ImageResponse } from '@vercel/og'
import { Icon } from '@/components/icon'
import { OG, OG_SIZE, OgCard } from '@/components/og-card'
import { ogFonts } from '@/lib/og-fonts'
import { getLadder } from '@/lib/queries'

export const runtime = 'nodejs'
export const alt = 'The Indiecraft ladder — the top founders by level'
export const size = OG_SIZE
export const contentType = 'image/png'

/**
 * The ladder's own card shows the actual top five rather than describing a
 * leaderboard. Names and quality colours are the argument; "top 100 by level"
 * is only the caption.
 */
export default async function Image() {
  const rows = await getLadder()
    .then((page) => page.rows.slice(0, 5))
    .catch(() => [])

  return new ImageResponse(
    <OgCard>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', fontSize: 24, color: OG.gold, letterSpacing: 9 }}>
          THE LADDER
        </div>
        <div style={{ display: 'flex', fontSize: 20, color: OG.muted, marginTop: 8 }}>
          Top 100 founders by level, then by item level
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22 }}>
          {rows.map((row) => (
            <div
              key={row.handle}
              style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}
            >
              <div style={{ display: 'flex', width: 40, fontSize: 22, color: OG.muted }}>
                {row.rank}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 46,
                  height: 46,
                  border: `2px solid ${row.rarity.hex}`,
                  background: OG.well,
                  color: row.rarity.hex,
                  fontSize: 24,
                }}
              >
                {row.level}
              </div>
              <div style={{ display: 'flex', marginLeft: 18, fontSize: 30, color: row.rarity.hex }}>
                @{row.handle}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginLeft: 18 }}>
                <Icon name={row.characterClass} size={20} color={OG.frame} />
                <div style={{ display: 'flex', marginLeft: 8, fontSize: 18, color: OG.muted }}>
                  {row.characterClass.toUpperCase()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </OgCard>,
    { ...size, fonts: await ogFonts },
  )
}
