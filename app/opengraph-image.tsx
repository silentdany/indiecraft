import { ImageResponse } from '@vercel/og'
import { BrandMark } from '@/components/brand-mark'
import { OG, OG_SIZE, OgCard, OgIcon } from '@/components/og-card'
import { RARITY_BY_NAME, SLOTS_BY_KEY, STAT_ICONS } from '@/engine'
import type { ArmorType, OffHandKind, RarityName, SlotKey, WeaponFamily } from '@/engine/types'
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
      icon: (() => {
        const item = slot?.items.find((i) => i.rarity === g.rarity)
        // Variants carry the famous ones: Sulfuras is the hammer a Shaman or a
        // Warrior wears, never the base entry.
        return (g.variant ? item?.variants?.[g.variant]?.icon : undefined) ?? item?.icon ?? ''
      })(),
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
          {/* Products, not the highest level on the realm. A top level is one
              person's number and it barely moves; the product count is the size
              of the thing being measured, which is what a stranger seeing this
              card for the first time is actually asking. "TRACKED" because the
              strip above already uses PRODUCTS for a founder's own count. */}
          <Stat
            icon="gear"
            src={icons.get(STAT_ICONS.gear ?? '')}
            value={stats.products.toLocaleString('en-US')}
            label="PRODUCTS TRACKED"
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
 * One slot per quality, ascending — and within that, the most recognisable item
 * the table has at each rung.
 *
 * Two audiences read this card and the row has to work for both. A founder sees
 * five business metrics worn as gear, which is the product in one line. Someone
 * who played Classic should get a jolt of recognition instead: Sulfuras and
 * Bloodfang and Striker's Mark are not generic fantasy squares, they are items
 * people farmed for months, and a stranger who recognises one of them will read
 * the rest of the card.
 *
 * That second test is what picked these over the prettier ones. Commons are the
 * hard rung — no white item in the game is famous — so it goes to the Battered
 * Buckler, which is at least the shield everybody started with.
 *
 * The silhouettes are deliberately five different shapes: shield, gauntlets,
 * gun, hood, hammer. Five squares of the same outline in five colours reads as
 * a palette; five different outlines reads as an inventory.
 *
 * Icons come from the live table rather than being pasted here, so a rebalance
 * that moves an item moves the card with it.
 */
const GEAR: {
  slot: SlotKey
  rarity: RarityName
  label: string
  variant?: ArmorType | OffHandKind | WeaponFamily
}[] = [
  { slot: 'offHand', rarity: 'common', label: 'REVENUE' },
  { slot: 'hands', rarity: 'uncommon', label: 'TECH STACK' },
  { slot: 'ranged', rarity: 'rare', label: 'VISITORS' },
  { slot: 'head', rarity: 'epic', label: 'DOMAIN' },
  { slot: 'mainHand', rarity: 'legendary', label: 'MRR', variant: 'hammer' },
]

function Stat({
  icon,
  src,
  value,
  label,
}: {
  icon: 'characters' | 'gear' | 'revenue'
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
