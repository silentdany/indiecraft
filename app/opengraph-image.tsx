import { ImageResponse } from '@vercel/og'
import { BrandMark } from '@/components/brand-mark'
import { OG, OG_SIZE, OgCard, OgIcon } from '@/components/og-card'
import { RARITY_BY_NAME, SLOTS_BY_KEY, STAT_ICONS } from '@/engine'
import type { RarityName, SlotKey } from '@/engine/types'
import { wowIcons } from '@/lib/og-fetch'
import { ogFonts } from '@/lib/og-fonts'
import { getRealmStats } from '@/lib/queries'

export const runtime = 'nodejs'
export const alt = 'World of Indiecraft — the founders’ armory'
export const size = OG_SIZE
export const contentType = 'image/png'

/**
 * The card for the site itself, shared whenever somebody links the armory
 * rather than a character.
 *
 * It used to be a wordmark, a sentence and three numbers on an empty panel —
 * true, and indistinguishable from any other dark landing page. Two things were
 * missing. There was no brand mark anywhere on it, which is odd for the one
 * image whose whole job is to be recognised in a feed. And nothing on it was a
 * PICTURE: the product turns a business into a character sheet, and the card
 * explained that in prose instead of showing it.
 *
 * The strip below is the fix and the thesis in one row — five real Classic item
 * squares in the five quality colours, each labelled with the business metric
 * that slot reads. Left to right it says what the sentence says, in the visual
 * language the site is built from, and it survives being 300px wide in a
 * timeline where the tagline does not.
 */
export default async function Image() {
  const stats = await getRealmStats().catch(() => null)

  const gear = GEAR.map((g) => {
    const slot = SLOTS_BY_KEY.get(g.slot)
    return {
      label: g.label,
      hex: RARITY_BY_NAME.get(g.rarity)?.hex ?? OG.frame,
      icon: slot?.items.find((i) => i.rarity === g.rarity)?.icon ?? '',
    }
  })

  const icons = await wowIcons([...gear.map((g) => g.icon), ...Object.values(STAT_ICONS)])

  return new ImageResponse(
    // signature off: the wordmark is the content here, and the mark that would
    // sit in the foot is in the lockup at full size instead.
    <OgCard signature={false}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <BrandMark size={104} color={OG.gold} />
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 26 }}>
            <div style={{ display: 'flex', fontSize: 24, color: OG.gold, letterSpacing: 10 }}>
              WORLD OF
            </div>
            <div style={{ display: 'flex', fontSize: 78, color: OG.butter, letterSpacing: 5 }}>
              INDIECRAFT
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 25, color: OG.text, marginTop: 20 }}>
          Lifetime revenue is XP. Your MRR is a weapon. Item level is what you wear.
        </div>
      </div>

      {/* The strip. Ascending quality left to right, so the row reads as a
          ladder rather than as five unrelated squares. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {gear.map((g) => (
          <div
            key={g.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: 196,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 104,
                height: 104,
                background: OG.well,
                border: `3px solid ${g.hex}`,
              }}
            >
              <OgIcon src={icons.get(g.icon)} glyph="gear" size={88} color={g.hex} />
            </div>
            <div
              style={{
                display: 'flex',
                marginTop: 12,
                fontSize: 16,
                color: g.hex,
                letterSpacing: 2,
              }}
            >
              {g.label}
            </div>
          </div>
        ))}
      </div>

      {stats && stats.characters > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stat
            icon="characters"
            src={icons.get(STAT_ICONS.characters ?? '')}
            value={stats.characters.toLocaleString('en-US')}
            label="CHARACTERS"
          />
          <Stat
            icon="level"
            src={icons.get(STAT_ICONS.level ?? '')}
            value={String(stats.maxLevel)}
            label="HIGHEST LEVEL"
          />
          <Stat
            icon="revenue"
            src={icons.get(STAT_ICONS.revenue ?? '')}
            value={compactUsd(stats.trackedMrrUsd)}
            label="TRACKED MRR"
          />
        </div>
      ) : (
        // Never leave the foot empty: an OgCard lays its children out with
        // space-between, and a missing last child collapses the whole rhythm.
        <div style={{ display: 'flex', fontSize: 15, color: OG.frame, letterSpacing: 4 }}>
          INDIECRAFT.QUEST
        </div>
      )}
    </OgCard>,
    { ...size, fonts: await ogFonts },
  )
}

/**
 * One slot per quality, ascending.
 *
 * Chosen so the five labels are the five least ambiguous words in the corpus —
 * somebody who has never seen the site should read the row and understand that
 * a business number is being worn as a piece of gear. The icons come from the
 * live table rather than being pasted here, so a rebalance that moves an item
 * moves the card with it.
 */
const GEAR: { slot: SlotKey; rarity: RarityName; label: string }[] = [
  // head at common and shoulders at rare, not the other way round: the common
  // shoulder is inv_shoulder_01, which is nearly black and reads as an empty
  // square at thumbnail size. The first cell is the one that has to survive
  // being small, so it gets the coif.
  { slot: 'head', rarity: 'common', label: 'DOMAIN' },
  { slot: 'neck', rarity: 'uncommon', label: 'FOLLOWERS' },
  { slot: 'shoulders', rarity: 'rare', label: 'PRODUCTS' },
  { slot: 'chest', rarity: 'epic', label: 'CUSTOMERS' },
  { slot: 'mainHand', rarity: 'legendary', label: 'MRR' },
]

function Stat({
  icon,
  src,
  value,
  label,
}: {
  icon: 'characters' | 'level' | 'revenue'
  /** The borrowed picture, when it arrived. `icon` is the fallback drawing. */
  src: string | undefined
  value: string
  label: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <OgIcon src={src} glyph={icon} size={32} color={OG.frame} />
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
