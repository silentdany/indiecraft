import { BrandMark } from '@/components/brand-mark'
import type { IconName } from '@/components/icon'
import { OG, OgIcon } from '@/components/og-card'

/**
 * The 9:16 poster. A different object from the 1200×630 timeline card: that
 * one is a sheet in miniature, this one is a picture somebody posts of
 * themselves. Face, name, class, rank, the two readouts, one sentence.
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
  rankLabel: string
  line: string
  gear: StoryGear[]
}

export function StoryCard({ model, portrait }: { model: StoryCardModel; portrait: string | null }) {
  const best = model.gear[0]
  const nameSize = model.displayName.length > 22 ? 48 : model.displayName.length > 16 ? 60 : 76
  const titleSize = model.classTitle.length > 22 ? 30 : model.classTitle.length > 16 ? 36 : 46

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: OG.bg,
        backgroundImage: `linear-gradient(180deg, ${tint(model.rarityColor, 0.2)} 0px, rgba(0,0,0,0) 640px)`,
        fontFamily: 'Cinzel',
      }}
    >
      <div
        style={{
          display: 'flex',
          height: 8,
          backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0) 0%, ${model.rarityColor} 22%, ${model.rarityColor} 78%, rgba(0,0,0,0) 100%)`,
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          flex: 1,
          margin: 28,
          padding: '48px 56px 40px',
          background: OG.panel,
          border: `2px solid ${OG.frame}`,
        }}
      >
        <Wordmark />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Portrait
            src={portrait}
            fallback={model.handle.slice(0, 1).toUpperCase()}
            color={model.rarityColor}
          />
          <div
            style={{
              display: 'flex',
              marginTop: 36,
              fontSize: nameSize,
              color: OG.butter,
              lineHeight: 1.05,
              textAlign: 'center',
              maxWidth: 880,
            }}
          >
            {model.displayName}
          </div>
          <div style={{ display: 'flex', marginTop: 12, fontSize: 28, color: OG.text }}>
            {`@${model.handle}`}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <OgIcon
              src={model.classIcon}
              glyph={model.classGlyph}
              size={44}
              color={model.classColor}
            />
            <div
              style={{
                display: 'flex',
                marginLeft: 16,
                fontSize: titleSize,
                color: model.classColor,
                letterSpacing: 3,
              }}
            >
              {model.classTitle}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 16,
              fontSize: 24,
              color: OG.gold,
              letterSpacing: 4,
            }}
          >
            {model.rankLabel}
          </div>
        </div>

        <div style={{ display: 'flex' }}>
          <Readout value={String(model.level)} label="LEVEL" color={OG.butter} border={OG.gold} />
          <Readout
            value={model.ilvl === null ? '—' : String(model.ilvl)}
            label="ILVL"
            color={model.ilvlColor}
            border={model.ilvlColor}
            gap
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              width: 880,
              fontSize: 32,
              lineHeight: 1.35,
              color: OG.text,
              textAlign: 'center',
              justifyContent: 'center',
            }}
          >
            {model.line}
          </div>
          {model.gear.length > 0 && (
            <div style={{ display: 'flex', marginTop: 28 }}>
              {model.gear.map((piece, i) => (
                <Square key={`${piece.stat}-${piece.name}`} piece={piece} gap={i > 0} />
              ))}
            </div>
          )}
          {best && (
            <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 14 }}>
              <div style={{ display: 'flex', fontSize: 24, color: best.color }}>{best.name}</div>
              <div
                style={{
                  display: 'flex',
                  marginLeft: 12,
                  fontSize: 14,
                  color: OG.muted,
                  letterSpacing: 2,
                }}
              >
                {best.stat.toUpperCase()}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', fontSize: 20, color: OG.muted, letterSpacing: 1 }}>
          {`indiecraft.quest/c/${model.handle}`}
        </div>
      </div>
    </div>
  )
}

function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <BrandMark size={36} color={OG.gold} />
      <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 12 }}>
        <div style={{ display: 'flex', fontSize: 12, color: OG.frame, letterSpacing: 5 }}>
          WORLD OF
        </div>
        <div style={{ display: 'flex', fontSize: 22, color: OG.gold, letterSpacing: 3 }}>
          INDIECRAFT
        </div>
      </div>
    </div>
  )
}

function Portrait({
  src,
  fallback,
  color,
}: {
  src: string | null
  fallback: string
  color: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 420,
        height: 420,
        border: `4px solid ${color}`,
        background: OG.well,
      }}
    >
      {src ? (
        // biome-ignore lint/performance/noImgElement: Satori renders raw <img>; next/image has no pipeline here.
        <img src={src} width={412} height={412} style={{ objectFit: 'cover' }} alt="" />
      ) : (
        <div style={{ display: 'flex', fontSize: 180, color }}>{fallback}</div>
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
        width: 280,
        height: 200,
        marginLeft: gap ? 24 : 0,
        border: `3px solid ${border}`,
        background: OG.well,
      }}
    >
      <div style={{ display: 'flex', fontSize: 108, color, lineHeight: 1 }}>{value}</div>
      <div
        style={{ display: 'flex', fontSize: 16, color: OG.muted, letterSpacing: 6, marginTop: 8 }}
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
        width: 92,
        height: 92,
        marginLeft: gap ? 12 : 0,
        border: `2px solid ${piece.color}`,
        background: OG.well,
      }}
    >
      {piece.src ? (
        // biome-ignore lint/performance/noImgElement: Satori renders raw <img>; next/image has no pipeline here.
        <img src={piece.src} width={80} height={80} alt="" />
      ) : (
        <div style={{ display: 'flex', fontSize: 36, color: piece.color }}>
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
