import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from '@vercel/og'
import { BrandMark } from '@/components/brand-mark'
import { ACHIEVEMENT_ICONS, Icon, type IconName } from '@/components/icon'
import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_BY_CODE,
  CLASS_COLORS,
  FACTIONS_BY_KEY,
  rarityFor,
} from '@/engine'
import type { CharacterPage } from '@/lib/queries'
import { getCharacter } from '@/lib/queries'
import { realmLabel } from '@/lib/realm'

/**
 * The OG image — technically the most important part of the product: this is
 * what travels, not the page.
 *
 * Acceptance constraint: 1200 × 630, but consumed at ~500px in a timeline and
 * usually on a phone. Shrink it to 300px and squint. Three things have to
 * survive that — the face, the name, the level — and they get the whole top
 * band. Everything below them is texture: at thumbnail size the stat strip and
 * the achievement row read as *a character sheet* rather than as any particular
 * numbers, which is the job. Somebody who wants the numbers is one tap away.
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
const LINE = '#2c2119'
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
  const faction = character.profile.faction
    ? FACTIONS_BY_KEY.get(character.profile.faction)
    : undefined

  // One round of fetches for every remote image on the card, in parallel and
  // individually failable. See remoteImage: a dead avatar must degrade to a
  // letter, never to a 500.
  const gear = character.equipment.slice(0, 4)
  const [portrait, ...gearIcons] = await Promise.all([
    remoteImage(character.avatarUrl),
    ...gear.map((piece) => remoteImage(piece.iconUrl)),
  ])

  const earned = character.achievements.slice(0, 9)
  const bar = Math.round(character.progress.ratio * 100)
  const ilvlColor = character.ilvl === null ? MUTED : rarityFor(character.ilvl).hex

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
      {/*
        space-between, not a stack with a spacer at the end.

        Four bands of fixed height inside a fixed 630 leave about a hundred
        spare pixels, and the first pass pushed all of them into one gap above
        the foot. One void reads as a bug; the same slack divided three ways
        reads as spacing somebody chose.
      */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          margin: 18,
          padding: '26px 34px 24px',
          background: PANEL,
          border: `2px solid ${FRAME}`,
        }}
      >
        {/* ---- The hero band. The only part that has to survive a thumbnail. */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Portrait character={character} src={portrait} />

          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 30, flex: 1 }}>
            {/* What changed — the only line that varies over time. */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Icon name={variant.icon} size={24} color={variant.kickerColor} />
              <div
                style={{
                  display: 'flex',
                  marginLeft: 10,
                  fontSize: 22,
                  color: variant.kickerColor,
                  letterSpacing: 4,
                }}
              >
                {variant.kicker}
              </div>
            </div>

            {/* Who. A name is what gets recognised in a timeline. */}
            <div
              style={{
                display: 'flex',
                fontSize: variant.nameSize,
                color: BUTTER,
                lineHeight: 1.05,
                marginTop: 8,
              }}
            >
              {variant.headline}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginTop: 12 }}>
              <div style={{ display: 'flex', fontSize: 21, color: TEXT }}>@{character.handle}</div>
              {character.profile.realm && (
                <Chip
                  icon="realm"
                  label={realmLabel(character.profile.realm)}
                  color={GOLD}
                  first={false}
                />
              )}
              {faction && (
                <Chip icon={faction.key} label={faction.key} color={faction.color} first={false} />
              )}
            </div>
          </div>

          {/* The two numbers the sheet exists to state, as two squares of the
              same family as the portrait.

              The iLvl wears its OWN quality colour, not the level's. Level
              rarity paints everything above 55 the same orange, so a card built
              from it had four orange borders saying one thing; iLvl rarity is
              what actually varies, and it is the reason the ladder colours that
              column and not this one. */}
          <div style={{ display: 'flex', marginLeft: 24 }}>
            <Readout value={String(character.level)} label="LEVEL" color={BUTTER} border={GOLD} />
            <Readout
              value={character.ilvl === null ? '—' : String(character.ilvl)}
              label="ILVL"
              color={ilvlColor}
              border={ilvlColor}
              gap
            />
          </div>
        </div>

        {/* ---- XP. A progress bar is the single most game-like object here,
                and it is the one thing on the card that says "not finished". */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              height: 14,
              background: WELL,
              border: `1px solid ${LINE}`,
            }}
          >
            <div style={{ display: 'flex', width: `${bar}%`, background: GOLD }} />
          </div>
          <div
            style={{ display: 'flex', fontSize: 15, color: MUTED, marginTop: 7, letterSpacing: 2 }}
          >
            {character.progress.next === null
              ? 'MAX LEVEL REACHED'
              : `${usdCompact(character.progress.next - character.xp)} OF XP TO LEVEL ${character.level + 1}`}
          </div>
        </div>

        {/* ---- Stats. Deliberately the same grammar as the panel on the sheet:
                a glyph in a square, a value, a name underneath. */}
        <div style={{ display: 'flex' }}>
          {statCells(character).map((cell, i) => (
            <StatCell key={cell.label} {...cell} first={i === 0} />
          ))}
        </div>

        {/* ---- The foot: what they own, what they have earned, and who made
                the picture. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {gear.length > 0 && (
              <FootRow label="GEAR">
                {gear.map((piece, i) => (
                  <Square
                    key={piece.slug}
                    size={46}
                    color={piece.rarity.hex}
                    src={gearIcons[i] ?? null}
                    fallback={(piece.name ?? '?').slice(0, 1).toUpperCase()}
                    gap={i > 0}
                  />
                ))}
                {/* Most founders here ship one product, which left a row with a
                    single 46px square and half the card empty beside it. The
                    name earns that space, and it is the one thing on the card a
                    reader might actually recognise. Dropped past two, where the
                    icons alone are the more legible answer. */}
                {gear.length <= 2 &&
                  gear.map((piece, i) => (
                    <div
                      key={`${piece.slug}-name`}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        marginLeft: i === 0 ? 14 : 18,
                      }}
                    >
                      <div style={{ display: 'flex', fontSize: 19, color: piece.rarity.hex }}>
                        {piece.name ?? piece.slug}
                      </div>
                      {piece.itemLevel !== null && (
                        <div style={{ display: 'flex', fontSize: 13, color: MUTED, marginLeft: 9 }}>
                          {`ILVL ${piece.itemLevel}`}
                        </div>
                      )}
                    </div>
                  ))}
              </FootRow>
            )}

            {earned.length > 0 && (
              <FootRow label="EARNED" top={12}>
                {earned.map((a, i) => (
                  <div
                    key={a.code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 36,
                      height: 36,
                      marginLeft: i > 0 ? 6 : 0,
                      border: `1px solid ${FRAME}`,
                      background: WELL,
                    }}
                  >
                    <Icon
                      name={ACHIEVEMENT_ICONS[a.code] ?? 'achievement'}
                      size={20}
                      color={GOLD}
                    />
                  </div>
                ))}
                <div style={{ display: 'flex', fontSize: 15, color: MUTED, marginLeft: 14 }}>
                  {`${character.achievements.length} of ${ACHIEVEMENTS.length}`}
                </div>
              </FootRow>
            )}
          </div>

          {/* Never arrive anonymous. */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <BrandMark size={28} color={GOLD} />
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 10 }}>
              <div style={{ display: 'flex', fontSize: 10, color: FRAME, letterSpacing: 5 }}>
                WORLD OF
              </div>
              <div style={{ display: 'flex', fontSize: 18, color: GOLD, letterSpacing: 3 }}>
                INDIECRAFT
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    { width: 1200, height: 630, fonts: await fonts },
  )
}

/**
 * The face.
 *
 * A card with a photograph on it is a different object from a card with a
 * letter on it — the first is a person, the second is a database row. It is the
 * one element here worth a network round trip.
 */
function Portrait({ character, src }: { character: CharacterPage; src: string | null }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 214,
        height: 214,
        flexShrink: 0,
        border: `4px solid ${character.rarity.hex}`,
        background: WELL,
      }}
    >
      {src ? (
        // biome-ignore lint/performance/noImgElement: Satori renders raw <img>; next/image has no pipeline here.
        <img src={src} width={206} height={206} style={{ objectFit: 'cover' }} alt="" />
      ) : (
        <div style={{ display: 'flex', fontSize: 94, color: character.rarity.hex }}>
          {character.handle.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  )
}

function Readout({
  value,
  label,
  color,
  border,
  gap,
}: {
  value: string
  label: string
  color: string
  border: string
  gap?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: 128,
        height: 128,
        marginLeft: gap ? 12 : 0,
        border: `3px solid ${border}`,
        background: WELL,
      }}
    >
      <div style={{ display: 'flex', fontSize: 64, color, lineHeight: 1 }}>{value}</div>
      <div style={{ display: 'flex', fontSize: 13, color: MUTED, letterSpacing: 5, marginTop: 4 }}>
        {label}
      </div>
    </div>
  )
}

/**
 * A labelled row in the foot.
 *
 * The fixed label column is the whole point: "GEAR" and "EARNED" are different
 * lengths, so two rows laid out inline started their icons at different x and
 * the foot read as two unrelated things stacked by accident.
 */
function FootRow({
  label,
  top,
  children,
}: {
  label: string
  top?: number
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginTop: top ?? 0 }}>
      <div
        style={{
          display: 'flex',
          width: 74,
          flexShrink: 0,
          fontSize: 12,
          color: FRAME,
          letterSpacing: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

/** Realm and faction, riding the handle line as two small marks. */
function Chip({
  icon,
  label,
  color,
  first,
}: {
  icon: IconName
  label: string
  color: string
  first: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginLeft: first ? 0 : 18 }}>
      <Icon name={icon} size={17} color={color} />
      <div style={{ display: 'flex', fontSize: 17, color, marginLeft: 7 }}>{label}</div>
    </div>
  )
}

function StatCell({
  icon,
  value,
  label,
  first,
}: {
  icon: IconName
  value: string
  label: string
  first: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flex: 1,
        padding: '14px 16px',
        marginLeft: first ? 0 : 8,
        border: `1px solid ${LINE}`,
        background: WELL,
      }}
    >
      <Icon name={icon} size={22} color={GOLD} />
      <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 11 }}>
        <div style={{ display: 'flex', fontSize: 27, color: GOLD, lineHeight: 1.1 }}>{value}</div>
        <div
          style={{ display: 'flex', fontSize: 11, color: MUTED, letterSpacing: 2, marginTop: 3 }}
        >
          {label}
        </div>
      </div>
    </div>
  )
}

/** A gear icon, or its initial when the CDN did not answer. */
function Square({
  size,
  color,
  src,
  fallback,
  gap,
}: {
  size: number
  color: string
  src: string | null
  fallback: string
  gap: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        marginLeft: gap ? 8 : 0,
        border: `1px solid ${color}`,
        background: WELL,
      }}
    >
      {src ? (
        // biome-ignore lint/performance/noImgElement: Satori renders raw <img>; next/image has no pipeline here.
        <img src={src} width={size - 6} height={size - 6} style={{ objectFit: 'cover' }} alt="" />
      ) : (
        <div style={{ display: 'flex', fontSize: size * 0.45, color }}>{fallback}</div>
      )}
    </div>
  )
}

/**
 * Four cells, chosen from what this founder actually has.
 *
 * A fixed set would print a dash on a third of the corpus, and a card padded
 * with dashes says less than a shorter one. Lifetime revenue and products are
 * always present, so the strip is never short.
 */
function statCells(character: CharacterPage) {
  const cells: { icon: IconName; value: string; label: string }[] = []
  const add = (icon: IconName, value: string | null, label: string) => {
    if (value !== null && cells.length < 4) cells.push({ icon, value, label })
  }

  add('revenue', usdCompact(character.revenueTotalUsd), 'LIFETIME')
  add('coins', character.mrrUsd > 0 ? `${usdCompact(character.mrrUsd)}` : null, 'MRR')
  add(
    'crowd',
    character.stats.customers === null ? null : num(character.stats.customers),
    'CUSTOMERS',
  )
  add(
    'rising',
    character.stats.growthMrr30d === null || character.stats.growthMrr30d <= 0
      ? null
      : `+${character.stats.growthMrr30d.toFixed(1)}%`,
    'GROWTH 30D',
  )
  add('gear', String(character.nProducts), character.nProducts === 1 ? 'PRODUCT' : 'PRODUCTS')
  add(
    'banner',
    character.stats.followers === null ? null : num(character.stats.followers),
    'FOLLOWERS',
  )
  add(
    'hourglass',
    character.stats.age === null ? null : `${character.stats.age.toFixed(1)}y`,
    'SHIPPING',
  )

  return cells
}

/**
 * A remote image, inlined, or null.
 *
 * Satori will happily fetch a URL itself, and that is exactly the problem: its
 * fetch has no timeout and no content-type check, so a slow CDN hangs the
 * render and TrustMRR's 403-as-XML answer for a missing logo throws inside the
 * renderer. Either one turns the single most important image in the product
 * into a 500 for that founder. Fetching here means every failure has the same
 * shape — null — and the card falls back to a letter nobody will notice.
 */
async function remoteImage(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2500) })
    if (!response.ok) return null
    const type = response.headers.get('content-type') ?? ''
    if (!type.startsWith('image/')) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    // An empty body renders as nothing; an enormous one is a decode nobody
    // asked for on a card that is 1200px wide.
    if (bytes.byteLength === 0 || bytes.byteLength > 3_000_000) return null
    return `data:${type};base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * The kicker is the only line that changes over time, so resharing the same
 * page stays interesting. Everything around it is now fixed structure — the
 * previous card reshaped itself per variant, which meant the level-up image and
 * the ordinary one did not read as the same product.
 */
function pickVariant(character: CharacterPage) {
  const name = character.displayName
  // A long name has to shrink or it runs off the card.
  const nameSize = name.length > 20 ? 40 : name.length > 14 ? 48 : 56

  // An event kicker keeps the interface gold: DING! is the site shouting, not
  // the character introducing themselves.
  if (character.recentLevelUp) {
    return {
      icon: 'level' as const,
      kicker: 'DING!',
      kickerColor: GOLD,
      headline: name,
      nameSize,
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
    }
  }
  return {
    icon: character.characterClass,
    kicker: `${character.characterClass.toUpperCase()} · RANK #${character.rank}`,
    // The class kicker wears the class colour: the shared image and the page
    // have to agree, or the colour system stops meaning anything the moment it
    // leaves the site.
    kickerColor: CLASS_COLORS[character.characterClass],
    headline: name,
    nameSize,
  }
}

const num = (v: number) => new Intl.NumberFormat('en-US').format(Math.round(v))

const usdCompact = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: v >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: v >= 10_000 ? 1 : 0,
  }).format(v)
