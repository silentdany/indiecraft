import {
  AbsoluteFill,
  Html5Video,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { CINEMATIC } from '../edit'
import { frames } from '../lib/zoom'

/**
 * The borrowed excerpt. Picture only.
 *
 * Muted on purpose: the audio is a separate track that runs under the entire
 * video, laid down in LaunchVideo. Leaving the inline audio on would play the
 * same six seconds twice, against itself.
 *
 * Two jobs beyond playing it. The first is the fit — see CINEMATIC.fit, which
 * is the difference between a sharp band and a wall of mush at this source
 * resolution. The second is the push-in: a still frame of somebody else's
 * cinematic looks like a screenshot, and a slow drift is what makes it read as
 * footage.
 */
export function Cinematic() {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  if (!CINEMATIC.src) return <Slate />

  const start = frames(CINEMATIC.trimBefore, fps)
  const fade = frames(CINEMATIC.fadeOut, fps)

  const push = interpolate(frame, [0, durationInFrames], [1, CINEMATIC.push], {
    extrapolateRight: 'clamp',
  })
  const blackout = interpolate(frame, [durationInFrames - fade, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  /*
   * Which decoder pulls the frames. See CINEMATIC.decoder — this is an
   * environment question, not a creative one.
   */
  const Clip = CINEMATIC.decoder === 'offthread' ? OffthreadVideo : Html5Video

  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        <Clip
          src={staticFile(CINEMATIC.src)}
          trimBefore={start}
          trimAfter={start + durationInFrames}
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: CINEMATIC.fit,
            /* Meaningless under `contain`, where nothing is cropped away, and
               harmless to leave — the browser ignores it. */
            objectPosition: `${CINEMATIC.focus[0] * 100}% ${CINEMATIC.focus[1] * 100}%`,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#000', opacity: blackout }} />
    </AbsoluteFill>
  )
}

/**
 * What plays when the footage is not there yet.
 *
 * staticFile() on a missing name throws at render time, which turns "you have
 * not dropped the clip in yet" into a stack trace three layers deep. This says
 * it instead, and it says it in the frame where the problem is.
 */
function Slate() {
  return (
    <AbsoluteFill
      style={{
        background: '#000',
        color: 'var(--ic-gold)',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 64,
        fontFamily: 'var(--ic-sans)',
        fontSize: 30,
        lineHeight: 1.6,
      }}
    >
      <div>
        <p style={{ fontFamily: 'var(--ic-serif)', fontSize: 44, letterSpacing: '0.06em' }}>
          NO FOOTAGE
        </p>
        <p style={{ color: 'var(--ic-text-muted)' }}>
          Put the excerpt in <code>video/public/</code>, then set <code>CINEMATIC.src</code> in{' '}
          <code>src/edit.ts</code> to its filename.
        </p>
      </div>
    </AbsoluteFill>
  )
}
