import { ImageResponse } from '@vercel/og'
import { Icon } from '@/components/icon'
import { OG, OG_SIZE, OgCard } from '@/components/og-card'
import { CLASS_RULES } from '@/engine/tuning'
import { ogFonts } from '@/lib/og-fonts'

export const runtime = 'nodejs'
export const alt = 'The Indiecraft rules — the level table, the class tree and every achievement'
export const size = OG_SIZE
export const contentType = 'image/png'

/**
 * The rules card shows the classes themselves, because "the formula is public"
 * is a promise and ten glyphs are evidence.
 */
export default async function Image() {
  return new ImageResponse(
    <OgCard>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', fontSize: 24, color: OG.gold, letterSpacing: 9 }}>
          THE RULES
        </div>
        <div style={{ display: 'flex', fontSize: 58, color: OG.butter, marginTop: 10 }}>
          Every number, and how it is worked out
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: OG.muted, marginTop: 14 }}>
          Sixty level tiers · ten classes · fifteen achievements
        </div>

        <div style={{ display: 'flex', marginTop: 34 }}>
          {CLASS_RULES.map((rule) => (
            <div
              key={rule.class}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 62,
                height: 62,
                marginRight: 12,
                border: `1px solid ${OG.frame}`,
                background: OG.well,
              }}
            >
              <Icon name={rule.class} size={30} color={OG.gold} />
            </div>
          ))}
        </div>
      </div>
    </OgCard>,
    { ...size, fonts: await ogFonts },
  )
}
