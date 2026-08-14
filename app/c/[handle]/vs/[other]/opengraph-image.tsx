import { ImageResponse } from '@vercel/og'
import { BrandMark } from '@/components/brand-mark'
import { OgIcon } from '@/components/og-card'
import { CLASS_COLORS, CLASS_ICONS, STAT_ICONS } from '@/engine'
import { remoteImage, wowIcons } from '@/lib/og-fetch'
import { ogFonts } from '@/lib/og-fonts'
import type { CharacterPage } from '@/lib/queries'
import { getCharacter } from '@/lib/queries'
import { versusRows } from '@/lib/versus-rows'

/**
 * The card for a comparison — the page most likely to be posted, and until now
 * the only one on the site with no picture at all.
 *
 * Its `generateMetadata` sets `openGraph: { title, url }`, which REPLACES the
 * inherited openGraph object rather than merging into it, so the root card the
 * page appeared to have was silently dropped. It shipped declaring
 * `twitter:card: summary_large_image` with nothing to show. Overriding
 * `openGraph` anywhere means owning the image too; the file convention here is
 * how that is owned.
 *
 * Which rows appear and who leads comes from lib/versus-rows.ts, the same
 * function the page uses. Nobody loses here either: the leader is marked and
 * the other side is simply not marked.
 */
export const runtime = 'nodejs'
export const alt = 'Two indie founders, stat for stat'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BG = '#170e09'
const PANEL = '#1a120c'
const WELL = '#100a06'
const LINE = '#2c2119'
const GOLD = '#f8b700'
const BUTTER = '#fff468'
const MUTED = '#9b9187'
const FRAME = '#6b552a'

export default async function Image({
  params,
}: {
  params: Promise<{ handle: string; other: string }>
}) {
  const { handle, other } = await params
  const [a, b] = await Promise.all([getCharacter(handle), getCharacter(other)])
  if (!a || !b) return new Response('Not found', { status: 404 })

  // Five rows: enough to be a comparison, few enough to stay legible at the
  // ~500px a timeline actually gives this.
  const rows = versusRows(a, b).slice(0, 5)
  const icons = await wowIcons([
    CLASS_ICONS[a.characterClass],
    CLASS_ICONS[b.characterClass],
    ...rows.map((r) => STAT_ICONS[r.icon]),
  ])

  const [portraitA, portraitB] = await Promise.all([
    remoteImage(a.avatarUrl),
    remoteImage(b.avatarUrl),
  ])

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: BG,
        border: `10px solid ${GOLD}`,
        fontFamily: 'Cinzel',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          margin: 18,
          padding: '24px 30px 20px',
          background: PANEL,
          border: `2px solid ${FRAME}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Head
            character={a}
            portrait={portraitA}
            classIcon={icons.get(CLASS_ICONS[a.characterClass])}
          />
          <div style={{ display: 'flex', fontSize: 40, color: FRAME, letterSpacing: 6 }}>VS</div>
          <Head
            character={b}
            portrait={portraitB}
            classIcon={icons.get(CLASS_ICONS[b.characterClass])}
            align="right"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '9px 0',
                borderTop: `1px solid ${LINE}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  flex: 1,
                  fontSize: row.winner === 'a' ? 27 : 23,
                  color: row.winner === 'a' ? GOLD : MUTED,
                }}
              >
                {row.a}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 250,
                  color: MUTED,
                }}
              >
                <OgIcon
                  src={icons.get(STAT_ICONS[row.icon] ?? '')}
                  glyph={row.icon}
                  size={19}
                  color={MUTED}
                />
                <div style={{ display: 'flex', marginLeft: 9, fontSize: 15, letterSpacing: 3 }}>
                  {row.label.toUpperCase()}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  flex: 1,
                  fontSize: row.winner === 'b' ? 27 : 23,
                  color: row.winner === 'b' ? GOLD : MUTED,
                }}
              >
                {row.b}
              </div>
            </div>
          ))}
        </div>

        {/* Never arrive anonymous. */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <BrandMark size={26} color={GOLD} />
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 10 }}>
            <div style={{ display: 'flex', fontSize: 10, color: FRAME, letterSpacing: 5 }}>
              WORLD OF
            </div>
            <div style={{ display: 'flex', fontSize: 17, color: GOLD, letterSpacing: 3 }}>
              INDIECRAFT
            </div>
          </div>
        </div>
      </div>
    </div>,
    { ...size, fonts: await ogFonts },
  )
}

function Head({
  character,
  portrait,
  classIcon,
  align = 'left',
}: {
  character: CharacterPage
  portrait: string | null
  /** The class emblem, when the CDN answered. The drawing is the fallback. */
  classIcon: string | undefined
  align?: 'left' | 'right'
}) {
  const name =
    character.displayName.length > 18
      ? `${character.displayName.slice(0, 17)}…`
      : character.displayName

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        // The two heads mirror around the VS, so the portraits sit outermost
        // and the names face each other.
        flexDirection: align === 'right' ? 'row-reverse' : 'row',
        width: 420,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 104,
          height: 104,
          flexShrink: 0,
          border: `3px solid ${character.rarity.hex}`,
          background: WELL,
        }}
      >
        {portrait ? (
          // biome-ignore lint/performance/noImgElement: Satori renders raw <img>; next/image has no pipeline here.
          <img src={portrait} width={98} height={98} style={{ objectFit: 'cover' }} alt="" />
        ) : (
          <div style={{ display: 'flex', fontSize: 44, color: character.rarity.hex }}>
            {character.handle.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: align === 'right' ? 'flex-end' : 'flex-start',
          margin: align === 'right' ? '0 18px 0 0' : '0 0 0 18px',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, color: BUTTER, lineHeight: 1.1 }}>{name}</div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 6 }}>
          <OgIcon
            src={classIcon}
            glyph={character.characterClass}
            size={19}
            color={CLASS_COLORS[character.characterClass]}
          />
          <div
            style={{
              display: 'flex',
              marginLeft: 8,
              fontSize: 16,
              letterSpacing: 3,
              color: CLASS_COLORS[character.characterClass],
            }}
          >
            {character.characterClass.toUpperCase()}
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 15, color: MUTED, marginTop: 5 }}>
          @{character.handle}
        </div>
      </div>
    </div>
  )
}
