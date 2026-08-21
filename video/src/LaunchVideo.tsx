import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useVideoConfig } from 'remotion'
import '@/app/globals.css'
import './styles/video.css'
import './lib/fonts'
import { ARMORY, CINEMATIC, END, SOUND } from './edit'
import { durationInSeconds } from './lib/media'
import { frames, seconds as secondsOf } from './lib/zoom'
import { Armory } from './scenes/Armory'
import { Cinematic } from './scenes/Cinematic'
import { EndCard } from './scenes/EndCard'
import { Hook, hookDuration } from './scenes/Hook'

/**
 * The whole thing: borrowed footage, the turn, the product, the address.
 *
 * The acts are laid end to end from their own declared durations rather than
 * from a table of absolute start frames, so lengthening the excerpt in edit.ts
 * moves everything after it instead of overlapping the copy onto it.
 *
 * globals.css is imported here and only here — one import, at the top of the
 * composition, so every scene shares the site's variables and every scene is
 * unable to drift from them.
 */
export function LaunchVideo() {
  /*
   * The composition's own length is the input, not an output.
   *
   * Root sets it from the music (see musicFrames), and the acts are laid out
   * inside whatever that turns out to be. Reading it back here rather than
   * recomputing it is what guarantees the armory act ends exactly where the
   * second take of music does: there is only one number, and it came from the
   * file.
   */
  const { fps, durationInFrames: total } = useVideoConfig()
  const acts = actLengths(fps, total)

  let at = 0
  const next = (length: number) => {
    const from = at
    at += length
    return { from, durationInFrames: length }
  }

  const seam = frames(SOUND.seam, fps)
  const fade = frames(SOUND.fadeOut, fps)
  const opening = acts.cinematic + acts.hook

  return (
    <AbsoluteFill style={{ background: 'var(--ic-bg)' }}>
      {SOUND.enabled && CINEMATIC.src && (
        <>
          {/*
            The opening take: starts with the picture and outlives it.

            Its Sequence spans the cinematic AND the copy, which is the whole
            trick — the picture cuts at twenty-nine seconds and the music does
            not, so the three lines land over something already playing rather
            than over a silence somebody has to fill.
          */}
          <Sequence from={0} durationInFrames={opening} name="Music — opening">
            <Audio
              src={staticFile(CINEMATIC.src)}
              trimBefore={frames(SOUND.opening, fps)}
              volume={(frame) =>
                interpolate(frame, [opening - seam, opening], [1, 0], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                })
              }
            />
          </Sequence>

          {/*
            The second take: jumps to SOUND.armory and plays out to the end of
            the file.

            No trimAfter, and none needed — the act is exactly as long as the
            MUSIC has left, which is a shorter thing than the file (SOUND.tail).
            The last note lands on the last frame of the armory, faded, and the
            end card cuts into silence. The arithmetic is in musicFrames below.
          */}
          <Sequence from={opening} durationInFrames={acts.armory} name="Music — armory">
            <Audio
              src={staticFile(CINEMATIC.src)}
              trimBefore={frames(SOUND.armory, fps)}
              volume={(frame) =>
                SOUND.armoryLevel *
                Math.min(
                  interpolate(frame, [0, seam], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                  interpolate(frame, [acts.armory - fade, acts.armory], [1, 0], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                )
              }
            />
          </Sequence>
        </>
      )}

      <Sequence {...next(acts.cinematic)}>
        <Cinematic />
      </Sequence>
      <Sequence {...next(acts.hook)}>
        <Hook />
      </Sequence>
      <Sequence {...next(acts.armory)}>
        <Armory />
      </Sequence>
      <Sequence {...next(acts.end)}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  )
}

/**
 * How long each act runs.
 *
 * Three of them state their own length. The armory is the elastic one: given a
 * `total` it takes whatever is left, which is how the act comes out exactly as
 * long as the second take of music without anybody having to do the
 * subtraction. Called without a total — the standalone act compositions, or
 * when the file cannot be read — every act runs at its declared length.
 *
 * The floor matters. A `SOUND.armory` cue near the end of the file would
 * otherwise hand the act a couple of frames, or a negative number of them, and
 * Remotion would refuse the composition with something far less obvious than a
 * tour that is briefer than intended.
 */
export function actLengths(fps: number, total?: number) {
  const cinematic = frames(CINEMATIC.duration, fps)
  const hook = hookDuration(fps)
  const end = frames(END.duration, fps)

  const armory =
    total === undefined
      ? frames(ARMORY.duration, fps)
      : Math.max(frames(ARMORY.minimum, fps), total - (cinematic + hook + end))

  return { cinematic, hook, armory, end }
}

/** The declared length, when nothing external is setting it. */
export function totalFrames(fps: number): number {
  const acts = actLengths(fps)
  return acts.cinematic + acts.hook + acts.armory + acts.end
}

/**
 * The length of the whole video, decided by the second take of music.
 *
 * The armory act runs from `SOUND.armory` to the end of the file, and the end
 * card follows it. So the total is the three declared acts plus however much
 * music is left after that cue — read off the file rather than written down,
 * which is the only way the end card reliably starts on the silence rather
 * than a third of a second before or after it.
 *
 * Every failure returns the declared length instead. A composition that cannot
 * be listed is a worse outcome than a composition of the wrong length: one of
 * those you can see and fix, the other stops the studio from opening at all.
 */
export async function musicFrames(fps: number): Promise<number> {
  if (!SOUND.enabled || !CINEMATIC.src) return totalFrames(fps)

  try {
    /*
     * Where the MUSIC ends, not where the file does.
     *
     * The container is longer than the audio it carries — see SOUND.tail —
     * and the difference is not cosmetic: sizing the act to the container ran
     * it past the last note, so the fade fired during silence and the music
     * stopped unfaded where it actually finished. That edge is a click.
     */
    const seconds = await durationInSeconds(staticFile(CINEMATIC.src))
    const left = seconds - secondsOf(SOUND.armory) - secondsOf(SOUND.tail)
    if (!(left > 0)) {
      console.warn(
        `SOUND.armory (${SOUND.armory}) is at or past the end of the music in ` +
          `${CINEMATIC.src}, which runs ${seconds.toFixed(2)}s less SOUND.tail. ` +
          'Falling back to the declared act lengths.',
      )
      return totalFrames(fps)
    }

    const acts = actLengths(fps)
    return acts.cinematic + acts.hook + Math.round(left * fps) + acts.end
  } catch (error) {
    console.warn(`Could not read the length of ${CINEMATIC.src}; using the declared one.`, error)
    return totalFrames(fps)
  }
}
