import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { Caption } from '../lib/captions'
import { frames } from '../lib/zoom'

/** `--ic-bg`, spelled out because a gradient stop cannot read a custom property. */
const GROUND = 'rgb(23, 14, 9)'

/**
 * The copy, over the thing it is about.
 *
 * A band across the foot of the frame rather than a card of its own, so no
 * second of the video is spent on words alone. It sits outside the camera —
 * ZoomPan scales its subtree, and a caption that zoomed with the sheet would
 * be furniture inside the shot instead of a voice over it.
 *
 * The scrim is a gradient rather than a box. A hard-edged panel reads as a
 * subtitle track bolted on afterwards; a wash that the sheet fades into reads
 * as part of the picture, and it keeps the type legible over the one thing
 * that is genuinely unpredictable underneath it — a gear grid of saturated
 * quality colours.
 */
export function CaptionBand({ captions }: { captions: Caption[] }) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  const showing = captions.find(
    (caption) => frame >= frames(caption.at, fps) && frame < frames(caption.until, fps),
  )
  if (!showing) return null

  const start = frames(showing.at, fps)
  const end = frames(showing.until, fps)

  /* In and out over about a third of a second each. Long enough not to blink,
     short enough that a two-second line is still two seconds of reading. */
  const enter = interpolate(frame, [start, start + 9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const leave = interpolate(frame, [end - 8, end], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const opacity = Math.min(enter, leave)

  /*
   * Sized off the SHORT side of the frame, not the width.
   *
   * The hook sizes its type off the width because it is a full-screen
   * statement and should fill whichever frame it is in. A caption is not: at
   * width * 0.05 the same line would be 54px in the vertical cut and 96px in
   * the landscape one, which is a headline. The short side is 1080 in both, so
   * this is one size that reads the same in both.
   */
  const size = Math.min(width, height) * 0.045

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', pointerEvents: 'none' }}>
      <div
        style={{
          width: '100%',
          paddingTop: size * 3.4,
          /*
           * Clear of the phone.
           *
           * TikTok, Reels and Shorts all paint their own furniture over the
           * bottom of the frame — handle, caption, buttons — and a line of
           * copy sitting 4% off the edge is a line of copy underneath a
           * username. A tenth of the frame height is the usual safe margin,
           * and it scales correctly to the landscape cut on its own.
           */
          paddingBottom: height * 0.1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: size * 0.5,
          opacity,
          /*
           * Opaque behind the type, fading only above it — and measured in
           * pixels rather than percentages of the band.
           *
           * Percentages drift: the same 40% stop that cleared a one-line
           * caption left "$12,145 of XP to level 52" ghosting through a
           * two-line one, which reads as a printing fault rather than as
           * depth. These stops are the padding plus two lines of text, so the
           * solid part always ends exactly where the words do, whatever the
           * words turn out to be.
           */
          background: `linear-gradient(to top, ${GROUND} 0px, ${GROUND} ${
            height * 0.1 + size * 2.8
          }px, rgba(23, 14, 9, 0) ${height * 0.1 + size * 5.8}px)`,
        }}
      >
        {/* The site's own section divider, at the size a caption can carry it.
            Without it the band is a subtitle; with it, it is the product
            talking. */}
        <span
          style={{
            width: size * 2.4,
            height: 1,
            background: 'var(--ic-frame)',
            transform: `scaleX(${enter})`,
          }}
        />
        <p
          style={{
            margin: 0,
            maxWidth: Math.min(width * 0.86, size * 22),
            textAlign: 'center',
            fontFamily: 'var(--ic-serif)',
            fontSize: size,
            lineHeight: 1.32,
            letterSpacing: '0.02em',
            fontWeight: 500,
            whiteSpace: 'pre-line',
            color: 'var(--ic-text)',
            transform: `translateY(${(1 - enter) * size * 0.35}px)`,
          }}
        >
          {showing.line}
        </p>
      </div>
    </AbsoluteFill>
  )
}
