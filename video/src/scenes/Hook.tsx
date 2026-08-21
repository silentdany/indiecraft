import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { HOOK } from '../edit'
import { frames } from '../lib/zoom'

/**
 * The turn: three lines, cut hard.
 *
 * Set in Cinzel on the site's own black, which is the join — the viewer has
 * just come off Blizzard's colour grade, and the copy is the first frame that
 * belongs to us. Nothing moves except the type, because a wipe or a slide here
 * would be the third visual idea in six seconds.
 */
export function Hook() {
  const { fps } = useVideoConfig()

  let offset = 0
  return (
    <AbsoluteFill style={{ background: 'var(--ic-bg)' }}>
      {HOOK.beats.map((beat) => {
        const from = offset
        const length = frames(beat.hold, fps)
        offset += length
        return (
          <Sequence key={beat.line} from={from} durationInFrames={length}>
            <Beat line={beat.line} tone={beat.tone} />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

export function hookDuration(fps: number): number {
  return HOOK.beats.reduce((total, beat) => total + frames(beat.hold, fps), 0)
}

function Beat({ line, tone }: { line: string; tone: 'ask' | 'answer' }) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames, width } = useVideoConfig()

  /* Up and in, settling with a little weight. The same spring the camera uses,
     for the same reason: type that eases out linearly reads as a slide. */
  const enter = spring({ frame, fps, config: { damping: 24, stiffness: 140, mass: 1 } })
  const leave = interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const answering = tone === 'answer'

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 8%',
        opacity: Math.min(enter, leave),
        transform: `translateY(${(1 - enter) * 28}px)`,
      }}
    >
      <p
        style={{
          margin: 0,
          textAlign: 'center',
          fontFamily: 'var(--ic-serif)',
          /* Sized off the frame, so the vertical and landscape cuts set the
             same line at the same optical size instead of one of them
             wrapping. */
          fontSize: width * (answering ? 0.068 : 0.06),
          lineHeight: 1.3,
          /* Cinzel is a Roman capital: wide, and wider still at these sizes.
             Left to the padding alone the second beat broke "No more play
             time." across two lines and turned a three-beat cut into a wall
             of type. The cap is in ems so it holds at both aspect ratios. */
          maxWidth: '15em',
          letterSpacing: '0.03em',
          fontWeight: 500,
          whiteSpace: 'pre-line',
          color: answering ? 'var(--ic-butter)' : 'var(--ic-text)',
        }}
      >
        {line}
      </p>
    </AbsoluteFill>
  )
}
