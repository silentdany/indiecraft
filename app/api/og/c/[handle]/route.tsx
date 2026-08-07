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

const BG = '#0d0b09'
const SURFACE = '#16120d'
const GOLD = '#c8a24a'
const GOLD_BRIGHT = '#f0c860'
const TEXT = '#e8dcc0'
const MUTED = '#9a8f78'

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
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: 1120,
          height: 550,
          background: SURFACE,
          border: `2px solid ${GOLD}`,
        }}
      >
        {/* Element 1 — the hook: what changed. */}
        <div style={{ display: 'flex', fontSize: 34, color: GOLD, letterSpacing: 6 }}>
          {variant.kicker}
        </div>

        {/* Element 2 — the number. It has to survive being read at 300px. */}
        <div
          style={{
            display: 'flex',
            fontSize: variant.headlineSize,
            color: GOLD_BRIGHT,
            lineHeight: 1,
            marginTop: 12,
          }}
        >
          {variant.headline}
        </div>

        {/* Element 3 — who, and of what class. */}
        <div style={{ display: 'flex', fontSize: 42, color: TEXT, marginTop: 28 }}>
          @{character.handle}
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: MUTED, marginTop: 8 }}>
          {character.characterClass} · rank {character.rank}
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
  if (character.recentLevelUp) {
    return {
      kicker: 'DING!',
      headline: `LEVEL ${character.level}`,
      headlineSize: 130,
    }
  }
  if (character.recentAchievement) {
    const def = ACHIEVEMENTS_BY_CODE.get(character.recentAchievement.code)
    return {
      kicker: 'ACHIEVEMENT',
      headline: (def?.label ?? character.recentAchievement.code).toUpperCase(),
      headlineSize: 96,
    }
  }
  return {
    kicker: 'LEVEL',
    headline: String(character.level),
    headlineSize: 260,
  }
}
