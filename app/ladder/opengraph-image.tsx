import { ImageResponse } from '@vercel/og'
import { OG, OG_SIZE, OgCard, OgIcon } from '@/components/og-card'
import { CLASS_ICONS } from '@/engine'
import { wowIcons } from '@/lib/og-fetch'
import { ogFonts } from '@/lib/og-fonts'
import { getLadder } from '@/lib/queries'

export const runtime = 'nodejs'
export const alt = 'The Indiecraft ladder — indie founders ranked by level'
export const size = OG_SIZE
export const contentType = 'image/png'

/**
 * The ladder's own card shows the actual top five rather than describing a
 * leaderboard. Names and quality colours are the argument; the caption is only
 * a caption — but it carries the real total, because the number of founders on
 * it is the reason to open the link.
 */
export default async function Image() {
  const { rows, total } = await getLadder()
    .then((page) => ({ rows: page.rows.slice(0, 5), total: page.total }))
    .catch(() => ({ rows: [], total: 0 }))

  const icons = await wowIcons(rows.map((r) => CLASS_ICONS[r.characterClass]))

  return new ImageResponse(
    <OgCard>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', fontSize: 24, color: OG.gold, letterSpacing: 9 }}>
          THE LADDER
        </div>
        <div style={{ display: 'flex', fontSize: 20, color: OG.muted, marginTop: 8 }}>
          {total > 0 ? `${total.toLocaleString('en-US')} founders` : 'Indie founders'} by level,
          then by item level
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
                <OgIcon
                  src={icons.get(CLASS_ICONS[row.characterClass])}
                  glyph={row.characterClass}
                  size={22}
                  color={OG.frame}
                />
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
