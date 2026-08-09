import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from '@vercel/og'
import { BrandMark } from '@/components/brand-mark'
import { ACHIEVEMENT_ICONS, Icon } from '@/components/icon'
import { ACHIEVEMENTS_BY_CODE, CLASS_COLORS } from '@/engine'
import { getCharacter } from '@/lib/queries'
import { realmLabel } from '@/lib/realm'

/**
 * The OG image — technically the most important part of the product: this is
 * what travels, not the page.
 *
 * Acceptance constraint: 1200 × 630, but consumed at ~500px in a timeline and
 * usually on a phone. Shrink it to 300px and squint. The level has to survive
 * that, which is why it sits in a fixed badge no variant can displace.
 *
 * The one thing it must never do is arrive anonymous. A gold card reading
 * "PALADIN 56" with no mark on it is a handsome picture of nothing: whoever
 * sees it has no idea what made it or where to go. The wordmark at the foot is
 * not decoration, it is most of the reason the image is worth rendering.
 *
 * The palette is duplicated from app/globals.css by hand, because Satori has no
 * CSS variables. Change one, change both. The glyphs come from the same two
 * components the site uses, passed an explicit colour — Satori does not resolve
 * `currentColor`.
 *
 * Node runtime rather than edge: the sheet is read with postgres.js, which
 * opens a TCP socket unavailable at the edge.
 */
export const runtime = 'nodejs'

// Loaded once, as an ArrayBuffer, from the repo. Never fetch Google Fonts at
// runtime: slow, fragile, and it breaks on edge.
const fonts = (async () => {
  const dir = join(process.cwd(), 'public', 'fonts')
  const [regular, medium] = await Promise.all([
    readFile(join(dir, 'Cinzel-Regular.ttf')),
    readFile(join(dir, 'Cinzel-Medium.ttf')),
  ])
  return [
    { name: 'Cinzel', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Cinzel', data: medium, weight: 500 as const, style: 'normal' as const },
  ]
})()

const BG = '#170e09'
const PANEL = '#1a120c'
const WELL = '#100a06'
const GOLD = '#f8b700'
const BUTTER = '#fff468'
const TEXT = '#ede7dc'
const MUTED = '#9b9187'
const FRAME = '#6b552a'

export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const character = await getCharacter(handle)

  if (!character) {
    return new Response('Character not found', { status: 404 })
  }

  const variant = pickVariant(character)

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: BG,
        // The quality colour states the hierarchy before a word is read.
        border: `10px solid ${character.rarity.hex}`,
        fontFamily: 'Cinzel',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          margin: 24,
          padding: '38px 46px 28px',
          background: PANEL,
          border: `2px solid ${FRAME}`,
        }}
      >
        {/* Centred in whatever space the wordmark leaves, rather than pinned to
            the top: space-between put the whole card in its upper half and left
            a third of it empty. */}
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          {/* The anchor. Every variant changes around it; it never moves. */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: 246,
              height: 246,
              flexShrink: 0,
              border: `4px solid ${character.rarity.hex}`,
              background: WELL,
            }}
          >
            <div style={{ display: 'flex', fontSize: 148, color: BUTTER, lineHeight: 1 }}>
              {character.level}
            </div>
            <div style={{ display: 'flex', fontSize: 21, color: MUTED, letterSpacing: 8 }}>
              LEVEL
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 44, flex: 1 }}>
            {/* What changed — the only line that varies over time. */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Icon name={variant.icon} size={30} color={variant.kickerColor} />
              <div
                style={{
                  display: 'flex',
                  marginLeft: 12,
                  fontSize: 27,
                  color: variant.kickerColor,
                  letterSpacing: 5,
                }}
              >
                {variant.kicker}
              </div>
            </div>

            {/* Who. The name is the headline because a name is what gets
                recognised in a timeline, and the level and class are already
                stated elsewhere on the card. */}
            <div
              style={{
                display: 'flex',
                fontSize: variant.nameSize,
                color: BUTTER,
                lineHeight: 1.05,
                marginTop: 12,
              }}
            >
              {variant.headline}
            </div>

            <div style={{ display: 'flex', fontSize: 24, color: TEXT, marginTop: 16 }}>
              @{character.handle}
            </div>
            <div style={{ display: 'flex', fontSize: 21, color: MUTED, marginTop: 8 }}>
              {variant.subline}
            </div>
          </div>
        </div>

        {/* Never arrive anonymous. */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <BrandMark size={30} color={GOLD} />
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 11 }}>
            <div style={{ display: 'flex', fontSize: 11, color: FRAME, letterSpacing: 5 }}>
              WORLD OF
            </div>
            <div style={{ display: 'flex', fontSize: 19, color: GOLD, letterSpacing: 3 }}>
              INDIECRAFT
            </div>
          </div>
        </div>
      </div>
    </div>,
    { width: 1200, height: 630, fonts: await fonts },
  )
}

/**
 * The same URL yields a different image over time, so resharing the same page
 * stays interesting.
 */
function pickVariant(character: NonNullable<Awaited<ReturnType<typeof getCharacter>>>) {
  const name = character.displayName
  // A long name has to shrink or it runs off the card.
  const nameSize = name.length > 18 ? 44 : name.length > 13 ? 56 : 66
  const rank = `rank #${character.rank}`
  const gear = character.ilvl === null ? 'no monthly score' : `item level ${character.ilvl}`
  // Realm and faction ride the subline when they exist. They are the two facts
  // on the card that place a founder rather than score them, and a shared image
  // that says "France · B2B" gets read by people the global rank means nothing
  // to.
  const standing = [
    character.profile.realm ? realmLabel(character.profile.realm) : null,
    character.profile.faction,
  ].filter(Boolean)

  // An event kicker keeps the interface gold: DING! is the site shouting, not
  // the character introducing themselves.
  if (character.recentLevelUp) {
    return {
      icon: 'level' as const,
      kicker: 'DING!',
      kickerColor: GOLD,
      headline: name,
      nameSize,
      subline: [character.characterClass, ...standing, rank].join(' · '),
    }
  }
  if (character.recentAchievement) {
    const def = ACHIEVEMENTS_BY_CODE.get(character.recentAchievement.code)
    return {
      icon: ACHIEVEMENT_ICONS[character.recentAchievement.code] ?? ('achievement' as const),
      kicker: (def?.label ?? character.recentAchievement.code).toUpperCase(),
      kickerColor: GOLD,
      headline: name,
      nameSize,
      subline: [character.characterClass, ...standing, rank].join(' · '),
    }
  }
  return {
    icon: character.characterClass,
    kicker: character.characterClass.toUpperCase(),
    // The class kicker wears the class colour: the shared image and the page
    // have to agree, or the colour system stops meaning anything the moment it
    // leaves the site.
    kickerColor: CLASS_COLORS[character.characterClass],
    headline: name,
    nameSize,
    subline: [gear, ...standing, rank].join(' · '),
  }
}
