import { ImageResponse } from '@vercel/og'
import { Icon } from '@/components/icon'
import { OG, OG_SIZE, OgCard } from '@/components/og-card'
import { ogFonts } from '@/lib/og-fonts'
import { getRealmStats } from '@/lib/queries'

export const runtime = 'nodejs'
export const alt = 'World of Indiecraft — the founders’ armory'
export const size = OG_SIZE
export const contentType = 'image/png'

/**
 * The card for the site itself, which is what gets shared when somebody links
 * the armory rather than a character. It carries live realm numbers for the
 * same reason the front page does: they are countable, and a claim with a
 * number behind it travels further than one without.
 */
export default async function Image() {
  const stats = await getRealmStats().catch(() => null)

  return new ImageResponse(
    <OgCard>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', fontSize: 26, color: OG.gold, letterSpacing: 10 }}>
          WORLD OF
        </div>
        <div style={{ display: 'flex', fontSize: 96, color: OG.butter, letterSpacing: 6 }}>
          INDIECRAFT
        </div>
        <div style={{ display: 'flex', fontSize: 27, color: OG.text, marginTop: 14 }}>
          Lifetime revenue is XP. MRR is item level. Your products are your gear.
        </div>

        {stats && stats.characters > 0 && (
          <div style={{ display: 'flex', marginTop: 34 }}>
            <Stat
              icon="characters"
              value={stats.characters.toLocaleString('en-US')}
              label="CHARACTERS"
            />
            <Stat icon="level" value={String(stats.maxLevel)} label="HIGHEST LEVEL" />
            <Stat icon="revenue" value={compactUsd(stats.trackedMrrUsd)} label="TRACKED MRR" />
          </div>
        )}
      </div>
    </OgCard>,
    { ...size, fonts: await ogFonts },
  )
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: 'characters' | 'level' | 'revenue'
  value: string
  label: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginRight: 46 }}>
      <Icon name={icon} size={30} color={OG.frame} />
      <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 11 }}>
        <div style={{ display: 'flex', fontSize: 34, color: OG.gold, lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ display: 'flex', fontSize: 14, color: OG.muted, letterSpacing: 2 }}>
          {label}
        </div>
      </div>
    </div>
  )
}

function compactUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}
