import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useVideoConfig } from 'remotion'
import '@/app/globals.css'
import './styles/video.css'
import './lib/fonts'
import { CINEMATIC, SOUND } from './edit'
import { filmById } from './films'
import type { Film } from './lib/film'
import { durationInSeconds } from './lib/media'
import { frames, seconds as secondsOf } from './lib/zoom'
import { Cinematic } from './scenes/Cinematic'
import { EndCard } from './scenes/EndCard'
import { Hook, hookDuration } from './scenes/Hook'
import { Shot } from './scenes/Shot'
import { Ladder } from './shots/Ladder'
import { Sheet } from './shots/Sheet'

/**
 * One component, four films.
 *
 * They share a grammar — footage, copy, a shot of the product, the name — and
 * each drops the parts it does not need. Writing four components would have
 * meant four places for the lockup to drift apart, and the whole point of a
 * campaign is that the four look like one thing.
 *
 * A type alias, not an interface: Remotion constrains a Composition's props to
 * `Record<string, unknown>`, and TypeScript gives object type aliases an
 * implicit index signature where it gives interfaces none.
 */
export type FilmProps = {
  filmId: string
  /** Frames into the source where the music starts. Set by calculateMetadata. */
  musicStart: number
}

export function FilmVideo({ filmId, musicStart }: FilmProps) {
  const { fps, durationInFrames: total } = useVideoConfig()
  const film = filmById(filmId)

  if (!film) throw new Error(`No film with id "${filmId}". See src/films.ts.`)

  const acts = filmActs(film, fps, total)
  const at = {
    sting: 0,
    beats: acts.sting,
    shot: acts.sting + acts.beats,
    end: acts.sting + acts.beats + acts.shot,
  }

  const seam = frames(SOUND.seam, fps)
  const fade = frames(SOUND.fadeOut, fps)

  return (
    <AbsoluteFill style={{ background: 'var(--ic-bg)' }}>
      {SOUND.enabled && CINEMATIC.src && (
        <Audio
          src={staticFile(CINEMATIC.src)}
          trimBefore={musicStart}
          volume={(frame) =>
            Math.min(
              /* Fading in, because every film cuts into the middle of a piece.
                 The launch video does not need this: it starts where the music
                 does. */
              interpolate(frame, [0, seam], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
              interpolate(frame, [total - fade, total], [1, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            )
          }
        />
      )}

      {film.sting && (
        <Sequence from={at.sting} durationInFrames={acts.sting}>
          <Cinematic
            src={film.sting.src ?? CINEMATIC.src}
            trimBefore={film.sting.from}
            fit={film.sting.fit ?? CINEMATIC.fit}
            focus={film.sting.focus ?? CINEMATIC.focus}
            backdrop={film.sting.backdrop ?? false}
          />
        </Sequence>
      )}

      {film.beats && (
        <Sequence from={at.beats} durationInFrames={acts.beats}>
          <Hook beats={film.beats} />
        </Sequence>
      )}

      {film.shot && (
        <Sequence from={at.shot} durationInFrames={acts.shot}>
          <Shot stops={film.stops ?? []} captions={film.captions}>
            {film.shot === 'ladder' ? <Ladder /> : <Sheet />}
          </Shot>
        </Sequence>
      )}

      <Sequence from={at.end} durationInFrames={acts.end}>
        <EndCard lockupOnly />
      </Sequence>
    </AbsoluteFill>
  )
}

/**
 * How long each part of a film runs.
 *
 * The shot is the elastic one, for the same reason the armory is in the launch
 * cut: copy is timed to be read and footage is timed to be felt, but a camera
 * move over a page can honestly be a second longer or shorter.
 *
 * With no shot — the first film is copy and a card — the slack goes to the
 * card instead, which just holds the lockup a beat longer. That is the right
 * failure: it is invisible, where a beat cut short is not.
 */
export function filmActs(film: Film, fps: number, total: number) {
  const sting = film.sting ? frames(film.sting.duration, fps) : 0
  const beats = film.beats ? hookDuration(fps, film.beats) : 0
  const end = frames(film.end, fps)
  const slack = total - (sting + beats + end)

  return film.shot
    ? { sting, beats, shot: Math.max(fps, slack), end }
    : { sting, beats, shot: 0, end: end + Math.max(0, slack) }
}

/**
 * Where in the source a film's music begins.
 *
 * Counted backwards from the last note — the end of the file less SOUND.tail —
 * so every film resolves on the same final bar rather than fading out
 * mid-phrase. Four films days apart, all landing on the same chord, is a
 * signature; four films fading out at random is four clips.
 */
export async function filmMusicStart(film: Film, fps: number): Promise<number> {
  if (!SOUND.enabled || !CINEMATIC.src) return 0

  try {
    const seconds = await durationInSeconds(staticFile(CINEMATIC.src))
    const lastNote = seconds - secondsOf(SOUND.tail)
    return Math.max(0, Math.round((lastNote - secondsOf(film.duration)) * fps))
  } catch (error) {
    console.warn(`Could not read ${CINEMATIC.src}; ${film.id} will open on the file.`, error)
    return 0
  }
}
