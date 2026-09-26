import { BrandMark } from '@/components/brand-mark'
import type { IconName } from '@/components/icon'
import { OG, OgIcon } from '@/components/og-card'

/**
 * The 9:16 poster. A different object from the 1200×630 timeline card: that
 * one is a sheet in miniature, this one is a picture somebody posts of
 * themselves. Face, name, class, rank, the two readouts, one sentence.
 *
 * Drawn as a character-select screen rather than a form. The first version
 * stacked five bordered boxes down a flat panel, and at story size that read
 * as a settings page: nothing glowed, the portrait was a third of the width,
 * and a third of the height was empty panel. Now the face is the picture, the
 * level sits on it the way a unit frame carries one, and the quality colour
 * lights the whole thing instead of only outlining a square.
 *
 * Satori has no CSS variables and no fragments. Every element with children
 * is `display: flex`. The palette is the same duplication og-card.tsx already
 * owns; the colours below that it does not list are the ones the timeline
 * card also hard-codes.
 */

export interface StoryGear {
  src: string | null
  color: string
  name: string
  stat: string
}

export interface StoryCardModel {
  handle: string
  displayName: string
  level: number
  ilvl: number | null
  ilvlColor: string
  rarityColor: string
  classTitle: string
  classColor: string
  /** Drawn when the borrowed class picture did not arrive. */
  classGlyph: IconName
  classIcon: string | undefined
  /** "#68". */
  rank: string
  /** "RANK OF 6,090", or "RANK" when the ladder size is unknown. */
  rankLabel: string
  line: string
  gear: StoryGear[]
}

const PORTRAIT = 560

export function StoryCard({ model, portrait }: { model: StoryCardModel; portrait: string | null }) {
  const best = model.gear[0]
  const nameSize = model.displayName.length > 24 ? 54 : model.displayName.length > 16 ? 68 : 86
  const titleSize = model.classTitle.length > 22 ? 32 : model.classTitle.length > 16 ? 38 : 46
  const lineSize = model.line.length > 60 ? 34 : model.line.length > 30 ? 40 : 56
  const glow = model.rarityColor

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: OG.well,
        backgroundImage: [
          `radial-gradient(circle at 50% 28%, ${tint(glow, 0.42)} 0%, ${tint(glow, 0.12)} 45%, rgba(0,0,0,0) 72%)`,
          `radial-gradient(ellipse at 50% 100%, ${tint(model.classColor, 0.16)} 0%, rgba(0,0,0,0) 70%)`,
          `linear-gradient(180deg, ${OG.bg} 0%, ${OG.well} 100%)`,
        ].join(', '),
        fontFamily: 'Cinzel',
      }}
    >
      <Frame color={glow} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '92px 72px 88px',
        }}
      >
        <Wordmark />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Portrait
            src={portrait}
            fallback={model.handle.slice(0, 1).toUpperCase()}
            color={glow}
            level={model.level}
          />
          <div
            style={{
              display: 'flex',
              marginTop: 92,
              fontSize: nameSize,
              color: OG.butter,
              lineHeight: 1.05,
              textAlign: 'center',
              justifyContent: 'center',
              maxWidth: 920,
              textShadow: `0 0 36px ${tint(OG.gold, 0.55)}, 0 4px 0 ${OG.well}`,
            }}
          >
            {model.displayName}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 14,
              fontSize: 30,
              color: OG.muted,
              letterSpacing: 2,
            }}
          >
            {`@${model.handle}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 34 }}>
            <div
              style={{
                display: 'flex',
                border: `2px solid ${model.classColor}`,
                boxShadow: `0 0 24px ${tint(model.classColor, 0.6)}`,
              }}
            >
              <OgIcon
                src={model.classIcon}
                glyph={model.classGlyph}
                size={56}
                color={model.classColor}
              />
            </div>
            <div
              style={{
                display: 'flex',
                marginLeft: 20,
                fontSize: titleSize,
                color: model.classColor,
                letterSpacing: 4,
                textShadow: `0 0 28px ${tint(model.classColor, 0.55)}`,
              }}
            >
              {model.classTitle}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Rule color={OG.frame} accent={OG.gold} />
          <div style={{ display: 'flex', marginTop: 38 }}>
            <Readout
              value={model.ilvl === null ? '—' : String(model.ilvl)}
              label="ITEM LEVEL"
              color={model.ilvlColor}
            />
            <div
              style={{
                display: 'flex',
                width: 2,
                margin: '8px 56px',
                backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0), ${OG.frame}, rgba(0,0,0,0))`,
              }}
            />
            <Readout value={model.rank} label={model.rankLabel} color={OG.gold} />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            width: 900,
            fontSize: lineSize,
            lineHeight: 1.3,
            color: OG.text,
            textAlign: 'center',
            justifyContent: 'center',
            textWrap: 'balance',
          }}
        >
          {`“${model.line}”`}
        </div>

        {model.gear.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex' }}>
              {model.gear.map((piece, i) => (
                <Square key={`${piece.stat}-${piece.name}`} piece={piece} gap={i > 0} />
              ))}
            </div>
            {best && (
              <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 22 }}>
                <div
                  style={{
                    display: 'flex',
                    fontSize: 28,
                    color: best.color,
                    textShadow: `0 0 18px ${tint(best.color, 0.5)}`,
                  }}
                >
                  {best.name}
                </div>
                <div
                  style={{
                    display: 'flex',
                    marginLeft: 14,
                    fontSize: 16,
                    color: OG.muted,
                    letterSpacing: 3,
                  }}
                >
                  {best.stat.toUpperCase()}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex' }} />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 16, color: OG.muted, letterSpacing: 6 }}>
            WHAT CLASS IS YOUR BUSINESS?
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 10,
              fontSize: 26,
              color: OG.gold,
              letterSpacing: 2,
            }}
          >
            {`indiecraft.quest/c/${model.handle}`}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * The border, drawn over everything. Two lines with a gap and a diamond at
 * each corner: the least it takes for the edge to read as a frame rather than
 * as the end of the image. The quality colour runs along the top and bottom
 * edges only, so it reads as light catching the frame rather than a second
 * border.
 */
function Frame({ color }: { color: string }) {
  const inset = 30
  const edge = inset - 11
  // Satori reads an `undefined` offset as a value and throws, so each corner
  // names only the two sides it is pinned to.
  const corners: Record<string, number>[] = [
    { top: edge, left: edge },
    { top: edge, right: edge },
    { bottom: edge, left: edge },
    { bottom: edge, right: edge },
  ]
  return (
    <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: inset,
          left: inset,
          right: inset,
          bottom: inset,
          border: `2px solid ${OG.frame}`,
        }}
      />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: inset + 10,
          left: inset + 10,
          right: inset + 10,
          bottom: inset + 10,
          border: `1px solid ${tint(OG.frame, 0.5)}`,
        }}
      />
      {[{ top: inset - 1 }, { bottom: inset - 1 }].map((edgeAt) => (
        <div
          key={Object.keys(edgeAt)[0]}
          style={{
            display: 'flex',
            position: 'absolute',
            left: 120,
            right: 120,
            height: 4,
            ...edgeAt,
            backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0) 0%, ${color} 30%, ${color} 70%, rgba(0,0,0,0) 100%)`,
            boxShadow: `0 0 24px ${tint(color, 0.8)}`,
          }}
        />
      ))}
      {corners.map((corner) => (
        <div
          key={Object.keys(corner).join('-')}
          style={{
            display: 'flex',
            position: 'absolute',
            ...corner,
            width: 22,
            height: 22,
            background: OG.well,
            border: `2px solid ${OG.gold}`,
            transform: 'rotate(45deg)',
          }}
        />
      ))}
    </div>
  )
}

function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <BrandMark size={44} color={OG.gold} />
      <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 14 }}>
        <div style={{ display: 'flex', fontSize: 14, color: OG.frame, letterSpacing: 6 }}>
          WORLD OF
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: OG.gold, letterSpacing: 4 }}>
          INDIECRAFT
        </div>
      </div>
    </div>
  )
}

/**
 * The face, lit from behind in the quality colour, with the level hung off
 * its bottom edge the way a unit frame carries it.
 */
function Portrait({
  src,
  fallback,
  color,
  level,
}: {
  src: string | null
  fallback: string
  color: string
  level: number
}) {
  const badge = 150
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        padding: 10,
        border: `2px solid ${OG.gold}`,
        background: OG.well,
        boxShadow: `0 0 120px ${tint(color, 0.55)}, 0 0 40px ${tint(color, 0.45)}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: PORTRAIT,
          height: PORTRAIT,
          border: `5px solid ${color}`,
          background: OG.well,
        }}
      >
        {src ? (
          // biome-ignore lint/performance/noImgElement: Satori renders raw <img>; next/image has no pipeline here.
          <img
            src={src}
            width={PORTRAIT - 10}
            height={PORTRAIT - 10}
            style={{ objectFit: 'cover' }}
            alt=""
          />
        ) : (
          <div style={{ display: 'flex', fontSize: 260, color }}>{fallback}</div>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: 10 + 5,
          right: 10 + 5,
          bottom: 10 + 5,
          height: 200,
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${tint(OG.well, 0.85)} 100%)`,
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute',
          left: (PORTRAIT + 24 - badge) / 2 - 2,
          bottom: -badge / 2,
          width: badge,
          height: badge,
          borderRadius: badge / 2,
          border: `4px solid ${OG.gold}`,
          background: OG.well,
          backgroundImage: `radial-gradient(circle at 50% 35%, ${OG.panel} 0%, ${OG.well} 100%)`,
          boxShadow: `0 0 0 6px ${OG.well}, 0 0 0 8px ${OG.frame}, 0 0 40px ${tint(OG.gold, 0.5)}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: level >= 100 ? 58 : 72,
            color: OG.butter,
            lineHeight: 1,
            marginTop: 6,
            textShadow: `0 0 20px ${tint(OG.gold, 0.7)}`,
          }}
        >
          {String(level)}
        </div>
        <div
          style={{ display: 'flex', fontSize: 14, color: OG.gold, letterSpacing: 5, marginTop: 4 }}
        >
          LEVEL
        </div>
      </div>
    </div>
  )
}

function Rule({ color, accent }: { color: string; accent: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div
        style={{
          display: 'flex',
          width: 300,
          height: 2,
          backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0), ${color})`,
        }}
      />
      <div
        style={{
          display: 'flex',
          width: 14,
          height: 14,
          margin: '0 18px',
          background: accent,
          transform: 'rotate(45deg)',
        }}
      />
      <div
        style={{
          display: 'flex',
          width: 300,
          height: 2,
          backgroundImage: `linear-gradient(90deg, ${color}, rgba(0,0,0,0))`,
        }}
      />
    </div>
  )
}

function Readout({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 300 }}>
      <div
        style={{
          display: 'flex',
          // "#1,234" at full size is wider than its half of the row.
          fontSize: value.length > 4 ? 100 : 124,
          color,
          lineHeight: 1,
          textShadow: `0 0 40px ${tint(color, 0.55)}`,
        }}
      >
        {value}
      </div>
      <div
        style={{ display: 'flex', fontSize: 18, color: OG.muted, letterSpacing: 6, marginTop: 14 }}
      >
        {label}
      </div>
    </div>
  )
}

function Square({ piece, gap }: { piece: StoryGear; gap: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 112,
        height: 112,
        marginLeft: gap ? 22 : 0,
        border: `3px solid ${piece.color}`,
        background: OG.well,
        boxShadow: `0 0 26px ${tint(piece.color, 0.55)}`,
      }}
    >
      {piece.src ? (
        // biome-ignore lint/performance/noImgElement: Satori renders raw <img>; next/image has no pipeline here.
        <img src={piece.src} width={100} height={100} alt="" />
      ) : (
        <div style={{ display: 'flex', fontSize: 44, color: piece.color }}>
          {piece.name.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  )
}

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
