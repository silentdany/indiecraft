import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from '@vercel/og'
import { ACHIEVEMENTS_BY_CODE } from '@/engine'
import { getCharacter } from '@/lib/queries'

/**
 * The OG image — technically the most important part of the product: this is
 * what travels, not the page.
 *
 * Principle: an achievement toast, not a character panel. What players share is
 * the gold frame that slides in at the top of the screen, not their stat sheet.
 *
 * Acceptance constraint: 1200 × 630, but consumed at ~500px in a timeline.
 * Shrink to 300px and squint — if the level is no longer legible, redo it.
 * Hence three elements, maximum.
 *
 * Node runtime rather than edge, contrary to the original intent: the sheet is
 * read with postgres.js, which opens a TCP socket unavailable on edge.
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

// Kept byte-for-byte in step with the tokens in app/globals.css. The whole
// point of the flat-rendering rule is that the thumbnail and the page look like
// the same product; letting these two palettes drift apart defeats it.
const BG = '#170e09'
const SURFACE = '#1e1610'
const FRAME = '#6b552a'
const GOLD = '#f8b700'
const BUTTER = '#fff468'
const TEXT = '#ede7dc'
const MUTED = '#9b9187'

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
        alignItems: 'center',
        justifyContent: 'center',
        background: BG,
        // The rarity color on the border gives the hierarchy without a word.
        border: `10px solid ${character.rarity.hex}`,
        fontFamily: 'Cinzel',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: 1120,
          height: 550,
          background: SURFACE,
          border: `2px solid ${FRAME}`,
          padding: '0 56px',
        }}
      >
        {/*
          The level badge is the anchor and never moves, whatever the variant
          says. The spec's acceptance test is "shrink to 300px and squint — if
          the level is not legible, redo it", and an achievement toast that
          replaced the number failed it outright: at thumbnail size there was a
          gold word and nothing else.
        */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: 300,
            height: 300,
            flexShrink: 0,
            border: `4px solid ${character.rarity.hex}`,
            background: BG,
          }}
        >
          <div style={{ display: 'flex', fontSize: 190, color: BUTTER, lineHeight: 1 }}>
            {character.level}
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: MUTED, letterSpacing: 8 }}>LEVEL</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 56, flex: 1 }}>
          {/* What changed — the only part that varies over time. */}
          <div style={{ display: 'flex', fontSize: 30, color: GOLD, letterSpacing: 7 }}>
            {variant.kicker}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: variant.headlineSize,
              color: BUTTER,
              lineHeight: 1.05,
              marginTop: 10,
            }}
          >
            {variant.headline}
          </div>

          {/* Who, and of what class. */}
          <div style={{ display: 'flex', fontSize: 38, color: TEXT, marginTop: 30 }}>
            @{character.handle}
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: MUTED, marginTop: 10 }}>
            {variant.subline}
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
function pickVariant(character: Awaited<ReturnType<typeof getCharacter>> & object) {
  const rank = `rank ${character.rank}`
  if (character.recentLevelUp) {
    return {
      kicker: 'DING!',
      headline: 'LEVEL UP',
      headlineSize: 88,
      subline: `${character.characterClass} · ${rank}`,
    }
  }
  if (character.recentAchievement) {
    const def = ACHIEVEMENTS_BY_CODE.get(character.recentAchievement.code)
    const label = (def?.label ?? character.recentAchievement.code).toUpperCase()
    // Long labels have to shrink, or "THOUSAND CUSTOMERS" runs off the card.
    return {
      kicker: 'ACHIEVEMENT',
      headline: label,
      headlineSize: label.length > 14 ? 62 : 84,
      subline: `${character.characterClass} · ${rank}`,
    }
  }
  const delta = character.ilvlDelta
  if (delta > 0) {
    return {
      kicker: 'GEARING UP',
      headline: `ILVL ${character.ilvl}`,
      headlineSize: 84,
      subline: `${character.characterClass} · ${rank}`,
    }
  }
  // The headline is already the class here, so repeating it below would waste
  // the one line left. iLvl is the number the sheet is actually about.
  return {
    kicker: 'THE ARMORY',
    headline: character.characterClass.toUpperCase(),
    headlineSize: 84,
    subline: `item level ${character.ilvl} · ${rank}`,
  }
}
