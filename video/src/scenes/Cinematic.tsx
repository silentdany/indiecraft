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
import { frames, type Time } from '../lib/zoom'

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
export function Cinematic({
  src = CINEMATIC.src,
  trimBefore = CINEMATIC.trimBefore,
  fit = CINEMATIC.fit,
  focus = CINEMATIC.focus,
  backdrop = false,
}: {
  src?: string | null
  trimBefore?: Time
  fit?: 'cover' | 'contain'
  focus?: [number, number]
  /**
   * Fill the letterbox with a blurred, enlarged copy of the same frame.
   *
   * For a shape that does not fit the frame and must not be cropped. The
   * gameplay clips are nearly square and their whole job is recognition —
   * which lives in the interface round the edges, so cropping to fill costs
   * exactly the thing the shot is for. This fills the bars instead.
   *
   * Off for the cinematic: a scope frame in black bars is a deliberate look,
   * and a blurred wash behind it would cheapen it into a phone video.
   */
  backdrop?: boolean
} = {}) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  if (!src) return <Slate />

  /* The length is the enclosing Sequence's, not a prop: whoever places this
     scene has already decided how long it runs, and asking twice is how the
     two answers start disagreeing. */
  const start = frames(trimBefore, fps)
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
      {backdrop && (
        <AbsoluteFill>
          <Clip
            src={staticFile(src)}
            trimBefore={start}
            trimAfter={start + durationInFrames}
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              /* Scaled past the edges so the blur has material to smear and
                 does not fade into the frame border. Darkened so it stays
                 backdrop rather than competing with the picture on top. */
              transform: 'scale(1.18)',
              filter: 'blur(52px) brightness(0.45) saturate(0.8)',
            }}
          />
        </AbsoluteFill>
      )}

      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        <Clip
          src={staticFile(src)}
          trimBefore={start}
          trimAfter={start + durationInFrames}
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: fit,
            /* Meaningless under `contain`, where nothing is cropped away, and
               harmless to leave — the browser ignores it. */
            objectPosition: `${focus[0] * 100}% ${focus[1] * 100}%`,
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
