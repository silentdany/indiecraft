import { ImageResponse } from '@vercel/og'
import { BrandMark } from '@/components/brand-mark'
import { ACHIEVEMENT_ICONS, Icon, type IconName } from '@/components/icon'
import { OgIcon } from '@/components/og-card'
import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_BY_CODE,
  achievementRarityHex,
  CLASS_COLORS,
  CLASS_ICONS,
  FACTIONS_BY_KEY,
  rarityFor,
  STAT_ICONS,
  UI_ICONS,
} from '@/engine'
import { remoteImage, wowIcons } from '@/lib/og-fetch'
import { ogFonts } from '@/lib/og-fonts'
import { ogImageId } from '@/lib/og-image'
import type { CharacterPage } from '@/lib/queries'
import { getCharacter } from '@/lib/queries'
import { realmLabel } from '@/lib/realm'
import { wowIconUrl } from '@/lib/wow-icon'

/**
 * The OG image — technically the most important part of the product: this is
 * what travels, not the page.
 *
 * ---------------------------------------------------------------------------
 * It lives here, as `opengraph-image`, and NOT at /api/og/c/[handle], which is
 * where it used to live and where it silently did not work.
 *
 * robots.txt carries `Disallow: /api/`, and the crawlers that render cards —
 * Twitterbot, facebookexternalhit, LinkedInBot, Slackbot — all obey robots.txt
 * before fetching an image named in a meta tag. The old file said they fetch it
 * "regardless of robots rules". They do not. The URL returned 200 to curl, to a
 * browser, and to every check that did not involve an actual crawler, which is
 * the worst possible failure shape: nothing to see anywhere except in the one
 * place it mattered.
 *
 * Keeping it under a route segment rather than under /api is what makes that
 * unrepeatable. It cannot drift back into a disallowed path without somebody
 * moving the file.
 * ---------------------------------------------------------------------------
 *
 * The file convention also earns three things the hand-rolled route had to do
 * without: Next emits og:image:width, height and type beside the URL, the
 * generated image is cached instead of re-rendered on every single scrape, and
 * the sheet's `generateMetadata` no longer has to name its own image.
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
export const alt = 'Indiecraft character sheet'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * The image URL carries the two numbers that change, because X caches a card
 * image against its URL and will not re-fetch one it has already seen. Without
 * this, a founder who dings 57 keeps sharing a picture of level 56 forever.
 *
 * This replaces a hand-appended `?v=` query on the meta tag: the id becomes
 * part of the path, which is both cacheable and impossible to strip.
 */
export async function generateImageMetadata({ params }: { params: { handle: string } }) {
  const character = await getCharacter(params.handle).catch(() => null)
  return [
    {
      id: character ? ogImageId(character.level, character.ilvl) : 'card',
      alt: character
        ? `${character.displayName} — level ${character.level} ${character.characterClass}`
        : alt,
      size,
      contentType,
    },
  ]
}

const BG = '#170e09'
const PANEL = '#1a120c'
const WELL = '#100a06'
const LINE = '#2c2119'
const GOLD = '#f8b700'
const BUTTER = '#fff468'
const TEXT = '#ede7dc'
const MUTED = '#9b9187'
const FRAME = '#6b552a'

/**
 * A quality colour at partial strength, for the two places the card wants the
 * hue without the shout. Satori has no `color-mix` and no alpha hex, so the
 * channels are unpacked by hand.
 */
function tint(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const n = Number.parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  )
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const character = await getCharacter(handle)

  if (!character) {
    return new Response('Character not found', { status: 404 })
  }

  const variant = pickVariant(character)
  const faction = character.profile.faction
    ? FACTIONS_BY_KEY.get(character.profile.faction)
    : undefined

  /*
   * The six best pieces they are wearing, rarest first.
   *
   * Sorted by quality rather than shown in slot order, because a card is read
   * at thumbnail size in a timeline: whatever is legendary has to land in the
   * first squares or it may as well not be there. Ties keep table order, which
   * is the reference's own, so the row stays stable between two founders with
   * the same spread.
   */
  const RARITY_RANK = ['common', 'uncommon', 'rare', 'epic', 'legendary']
  const worn = character.doll
    .filter((s) => s.item !== null)
    .sort(
      (a, b) =>
        RARITY_RANK.indexOf(b.item?.rarity.name ?? '') -
        RARITY_RANK.indexOf(a.item?.rarity.name ?? ''),
    )
    .slice(0, 6)
  const best = worn[0]

  // One round of fetches for every remote image on the card, in parallel and
  // individually failable. See remoteImage: a dead avatar must degrade to a
  // letter, never to a 500.
  const earned = character.achievements.slice(0, 9)

  const [portrait, ...remote] = await Promise.all([
    remoteImage(character.avatarUrl),
    ...worn.map((slot) => remoteImage(slot.item ? wowIconUrl(slot.item.icon) : null)),
    // The badges the founder holds, in the reference's own art. The drawn glyph
    // stays as the fallback below: nine failed fetches must not blank a row.
    ...earned.map((a) =>
      remoteImage(
        ACHIEVEMENTS_BY_CODE.get(a.code)?.icon
          ? wowIconUrl(ACHIEVEMENTS_BY_CODE.get(a.code)?.icon ?? '')
          : null,
      ),
    ),
  ])
  const wornIcons = remote.slice(0, worn.length)
  const earnedIcons = remote.slice(worn.length)

  /*
   * Everything else with a borrowed picture: the kicker's glyph, the faction
   * banner, and the four stat cells. One batch, deduplicated, and each one
   * falls back to its drawing — the card must render even if the CDN is down.
   */
  const cells = statCells(character)
  const uiIcons = await wowIcons([
    variant.slug,
    faction?.icon,
    ...cells.map((c) => STAT_ICONS[c.icon]),
  ])
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
        /*
         * The quality colour used to be a 10px slab around the whole 1200×630.
         * It was the loudest thing on the card and it was worst exactly where
         * most people are: common was grey at the time, so three quarters of
         * the corpus were sharing a picture wrapped in a thick grey band. A frame that
         * says "unremarkable" in the largest voice on the image is the opposite
         * of what a share card is for.
         *
         * It also said nothing new. The portrait border, the iLvl readout and
         * every gear name already carry the quality — the slab was the fourth
         * copy and the only ugly one.
         *
         * What is left: a 5px bar along the top edge, and a wash under it that
         * fades out before the hero band. Enough hue to read the tier at
         * thumbnail size, quiet enough that grey looks deliberate.
         */
        backgroundImage: `linear-gradient(180deg, ${tint(character.rarity.hex, 0.14)} 0px, rgba(0,0,0,0) 260px)`,
        fontFamily: 'Cinzel',
      }}
    >
      {/*
        Centre-weighted, not a flat rule.

        A 1200px line of #1eff00 at full strength is the same problem the slab
        had in miniature — the quality palette is built to be read on 16px item
        squares, and stretched across a whole edge those hues stop being
        information and start being glare. Fading both ends keeps the hue where
        the eye already is and lets it go where it would only shout.
      */}
      <div
        style={{
          display: 'flex',
          height: 5,
          backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0) 0%, ${character.rarity.hex} 28%, ${character.rarity.hex} 72%, rgba(0,0,0,0) 100%)`,
        }}
      />
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
              <OgIcon
                src={variant.slug ? uiIcons.get(variant.slug) : undefined}
                glyph={variant.icon}
                size={26}
                color={variant.kickerColor}
              />
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
                  src={undefined}
                  label={realmLabel(character.profile.realm)}
                  color={GOLD}
                  first={false}
                />
              )}
              {faction && (
                <Chip
                  icon={faction.key}
                  src={uiIcons.get(faction.icon)}
                  label={faction.key}
                  color={faction.color}
                  first={false}
                />
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
          {cells.map((cell, i) => (
            <StatCell
              key={cell.label}
              {...cell}
              src={uiIcons.get(STAT_ICONS[cell.icon] ?? '')}
              first={i === 0}
            />
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
            {/*
              The worn equipment, as pictures.

              This row used to be the founder's PRODUCTS, drawn as squares of
              their favicon and, below two of them, their names. That was the
              best available answer before the paper doll existed and the wrong
              one after it: a share card whose job is to say "this is a
              character sheet" was spending its most game-shaped row on four
              website icons, while the actual gear — real item art, real quality
              colours, the single most recognisable thing the product now owns —
              appeared nowhere on it.

              Best pieces first, not slot order. A card is read at thumbnail
              size in a timeline; the legendary has to be in the first two
              squares or nobody sees it.
            */}
            {worn.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <FootRow label="GEAR">
                  {worn.map((slot, i) => (
                    <Square
                      key={slot.slot}
                      size={58}
                      color={slot.item?.rarity.hex ?? MUTED}
                      src={wornIcons[i] ?? null}
                      fallback=""
                      gap={i > 0}
                    />
                  ))}
                </FootRow>

                {/*
                  The best piece, captioned under the row rather than beside it.

                  It sat at the end of the squares, which put the name of the
                  FIRST item — the row is sorted rarest first — immediately to
                  the right of the last one. Every reader joined the two: the
                  card looked like it had six slots where the sixth had rendered
                  as text instead of art. Below the row and indented to the same
                  edge, it reads as what it is: a caption naming the best of
                  them, and the line that makes a stranger ask what a
                  "Cashbringer" is.
                */}
                {best?.item && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      marginLeft: 74,
                      marginTop: 7,
                    }}
                  >
                    <div style={{ display: 'flex', fontSize: 18, color: best.item.rarity.hex }}>
                      {best.item.name}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        fontSize: 12,
                        color: MUTED,
                        marginLeft: 10,
                        letterSpacing: 2,
                      }}
                    >
                      {best.stat.toUpperCase()}
                    </div>
                  </div>
                )}
              </div>
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
                    {earnedIcons[i] ? (
                      // biome-ignore lint/performance/noImgElement: Satori renders raw <img>; next/image has no pipeline here.
                      <img src={earnedIcons[i] ?? ''} width={34} height={34} alt="" />
                    ) : (
                      <Icon
                        name={ACHIEVEMENT_ICONS[a.code] ?? 'achievement'}
                        size={20}
                        color={GOLD}
                      />
                    )}
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
    { ...size, fonts: await ogFonts },
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
        border: `3px solid ${character.rarity.hex}`,
        background: WELL,
      }}
    >
      {src ? (
        // biome-ignore lint/performance/noImgElement: Satori renders raw <img>; next/image has no pipeline here.
        <img src={src} width={208} height={208} style={{ objectFit: 'cover' }} alt="" />
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
  src,
  label,
  color,
  first,
}: {
  icon: IconName
  /** The borrowed picture, when there is one. A country has none. */
  src: string | undefined
  label: string
  color: string
  first: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginLeft: first ? 0 : 18 }}>
      <OgIcon src={src} glyph={icon} size={19} color={color} />
      <div style={{ display: 'flex', fontSize: 17, color, marginLeft: 7 }}>{label}</div>
    </div>
  )
}

function StatCell({
  icon,
  src,
  value,
  label,
  first,
}: {
  icon: IconName
  /** The borrowed picture; `icon` is the drawing behind it. */
  src: string | undefined
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
      <OgIcon src={src} glyph={icon} size={24} color={GOLD} />
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
      slug: UI_ICONS.timelineLevel as string | undefined,
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
      slug: ACHIEVEMENTS_BY_CODE.get(character.recentAchievement.code)?.icon,
      kicker: (def?.label ?? character.recentAchievement.code).toUpperCase(),
      // Its quality colour, for the same reason the class kicker wears the
      // class colour: the card and the page have to agree, or the colour
      // system stops meaning anything the moment it leaves the site.
      kickerColor: achievementRarityHex(def?.rarity),
      headline: name,
      nameSize,
    }
  }
  return {
    icon: character.characterClass,
    slug: CLASS_ICONS[character.characterClass] as string | undefined,
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
