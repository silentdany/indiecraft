import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { BrandMark } from '@/components/brand-mark'
import { END } from '../edit'

/**
 * The card that has to survive being screenshotted.
 *
 * Same lockup as the site's top bar — crest, "World of", INDIECRAFT — because
 * the last frame of the video and the first frame of the site should be
 * recognisably the same object. The URL is the only thing here that is bigger
 * than it needs to be, and deliberately: it is the one instruction.
 *
 * Everything is sized off the SHORT side of the frame. It used to be sized off
 * the width, which is fine in a 1080-wide vertical post and absurd in a
 * 1920-wide landscape one — the same crest came out at 119px in one cut and
 * 211px in the other, on a frame that was half as tall. The short side is 1080
 * in both, so one number now means one size.
 */
export function EndCard({ lockupOnly = false }: { lockupOnly?: boolean } = {}) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  /*
   * Bigger when it is alone.
   *
   * The teaser's card carries the lockup and nothing else, and a mark sized to
   * sit above three lines of text looks lost with nothing under it. This is
   * the same card, not a second design — one number changes.
   *
   * 1.24 and not more: at 1.32 the wordmark reached 84% of the vertical
   * frame's width, and a brand card that nearly touches both edges reads as a
   * mistake rather than as confidence.
   */
  const unit = Math.min(width, height) * (lockupOnly ? 1.24 : 1)

  const enter = spring({ frame, fps, config: { damping: 22, stiffness: 120, mass: 1 } })
  const urlIn = interpolate(frame, [8, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  /* Last in, so the eye arrives at the address first and the citation is what
     it finds when it looks for the catch. */
  const sourceIn = interpolate(frame, [20, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{
        background: 'var(--ic-bg)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: unit * 0.03,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: unit * 0.022,
          opacity: enter,
          transform: `scale(${0.94 + enter * 0.06})`,
        }}
      >
        <BrandMark size={unit * 0.11} title="World of Indiecraft" />
        <div style={{ textAlign: 'left', lineHeight: 1.05 }}>
          <div
            style={{
              fontFamily: 'var(--ic-sans)',
              fontSize: unit * 0.028,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--ic-text-muted)',
            }}
          >
            {END.over}
          </div>
          <div
            style={{
              fontFamily: 'var(--ic-serif)',
              fontSize: unit * 0.072,
              letterSpacing: '0.04em',
              color: 'var(--ic-gold)',
            }}
          >
            {END.name}
          </div>
        </div>
      </div>

      {/* The teaser drops all three: two questions and a name, and nothing
          that reads as a caption under a logo. */}
      {!lockupOnly && (
        <>
          <p
            style={{
              margin: 0,
              opacity: urlIn,
              fontFamily: 'var(--ic-sans)',
              fontSize: unit * 0.03,
              color: 'var(--ic-text-muted)',
            }}
          >
            {END.line}
          </p>

          <p
            style={{
              margin: 0,
              opacity: urlIn,
              transform: `translateY(${(1 - urlIn) * 12}px)`,
              fontFamily: 'var(--ic-serif)',
              fontSize: unit * 0.058,
              letterSpacing: '0.03em',
              color: 'var(--ic-butter)',
            }}
          >
            {END.url}
          </p>

          {/* The citation, at the size a citation goes. Small, late, and under the
            instruction rather than competing with it — but present, because the
            whole armory rests on somebody else's numbers being real. */}
          <p
            style={{
              margin: 0,
              marginTop: unit * 0.01,
              opacity: sourceIn,
              fontFamily: 'var(--ic-sans)',
              fontSize: unit * 0.022,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--ic-text-muted)',
            }}
          >
            {END.source}
          </p>
        </>
      )}
    </AbsoluteFill>
  )
}
