import { ImageResponse } from '@vercel/og'
import { NextResponse } from 'next/server'
import { StoryCard, type StoryCardModel } from '@/components/story-card'
import { CLASS_COLORS, CLASS_ICONS } from '@/engine'
import { STORY_SIZE } from '@/lib/card-image'
import { remoteImage, wowIcons } from '@/lib/og-fetch'
import { ogFonts } from '@/lib/og-fonts'
import { ogImageId } from '@/lib/og-image'
import { posterLine } from '@/lib/poster-copy'
import { type CharacterPage, getCharacter } from '@/lib/queries'

/**
 * The 9:16 poster.
 *
 * The id is the cache bust, not a version we store. A URL from before a
 * level-up redirects to the current one, and the current one is a different
 * path, so a cache that already holds the old picture is not asked to forget
 * it. Negotiation is kept off this path in lib/negotiable.ts.
 */
export const runtime = 'nodejs'
export const revalidate = 86400

const RARITY_RANK = ['common', 'uncommon', 'rare', 'epic', 'legendary']
const MUTED = '#9b9187'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string; id: string }> },
) {
  const { handle, id } = await params
  const character = await getCharacter(handle)
  if (!character) return new Response('Character not found', { status: 404 })

  const current = ogImageId(character.level, character.ilvl)
  if (id !== current) {
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    return NextResponse.redirect(`${origin}/c/${character.handle}/poster/${current}`, 308)
  }

  const worn = character.doll
    .flatMap((slot) => (slot.item ? [{ stat: slot.stat, item: slot.item }] : []))
    .sort(
      (a, b) => RARITY_RANK.indexOf(b.item.rarity.name) - RARITY_RANK.indexOf(a.item.rarity.name),
    )
    .slice(0, 5)

  const classSlug = CLASS_ICONS[character.characterClass]
  const [portrait, icons] = await Promise.all([
    remoteImage(character.avatarUrl),
    wowIcons([classSlug, ...worn.map((piece) => piece.item.icon)]),
  ])

  const model: StoryCardModel = {
    handle: character.handle,
    displayName: character.displayName || character.handle,
    level: character.level,
    ilvl: character.ilvl,
    ilvlColor: character.ilvlRarity?.hex ?? MUTED,
    rarityColor: character.rarity.hex,
    classTitle: classTitle(character),
    classColor: CLASS_COLORS[character.characterClass],
    classGlyph: character.characterClass,
    classIcon: icons.get(classSlug),
    rank: `#${new Intl.NumberFormat('en-US').format(character.rank)}`,
    rankLabel: rankLabel(character.rankContext?.total ?? null),
    line: posterLine({
      level: character.level,
      characterClass: character.characterClass,
      mrrUsd: character.mrrUsd,
      recentLevelUp: character.recentLevelUp?.level ?? null,
    }),
    gear: worn.map((piece) => ({
      src: icons.get(piece.item.icon) ?? null,
      color: piece.item.rarity.hex,
      name: piece.item.name,
      stat: piece.stat,
    })),
  }

  const image = new ImageResponse(<StoryCard model={model} portrait={portrait} />, {
    ...STORY_SIZE,
    fonts: await ogFonts,
  })
  image.headers.set('Cache-Control', 'public, max-age=86400')
  return image
}

function classTitle(character: CharacterPage): string {
  const spec = character.talents.spec
  return (spec ? `${spec} ${character.characterClass}` : character.characterClass).toUpperCase()
}

function rankLabel(total: number | null): string {
  if (!total) return 'RANK'
  return `RANK OF ${new Intl.NumberFormat('en-US').format(total)}`
}
