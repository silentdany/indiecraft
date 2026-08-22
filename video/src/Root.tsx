import { Fragment } from 'react'
import { type CalculateMetadataFunction, Composition } from 'remotion'
import { ARMORY, CINEMATIC, FPS } from './edit'
import { type FilmProps, FilmVideo, filmMusicStart } from './FilmVideo'
import { FILMS, filmById } from './films'
import { actLengths, LaunchVideo, musicFrames, totalFrames } from './LaunchVideo'
import { frames } from './lib/zoom'
import { Armory } from './scenes/Armory'
import { Cinematic } from './scenes/Cinematic'
import { EndCard } from './scenes/EndCard'
import { Hook } from './scenes/Hook'

/**
 * Everything that renders: the launch cut, the four films leading up to it,
 * and the acts on their own.
 *
 * The single-act compositions are not deliverables — they exist because aiming
 * a close-up means scrubbing the same four seconds twenty times, and doing
 * that inside a full video means waiting through the cinematic every reload.
 */

/**
 * The length of the launch cut, read off the music.
 *
 * `calculateMetadata` is the only place Remotion will wait for an answer
 * before deciding how long a composition is. It runs in a browser — in the
 * studio and again in the headless Chrome the renderer drives — which is why
 * the reader in lib/media is a browser-capable one.
 */
const fromTheMusic: CalculateMetadataFunction<Record<string, unknown>> = async () => ({
  durationInFrames: await musicFrames(FPS),
})

/** The same, cut down to the armory's share, for the working composition. */
const armoryFromTheMusic: CalculateMetadataFunction<Record<string, unknown>> = async () => ({
  durationInFrames: actLengths(FPS, await musicFrames(FPS)).armory,
})

/**
 * A film states its own length — six seconds is a format decision, not a
 * musical one — so all this reads from the file is where to start the music so
 * that it ENDS with the film. One function for all four; the id arrives in the
 * props.
 */
const filmMetadata: CalculateMetadataFunction<FilmProps> = async ({ props }) => {
  const film = filmById(props.filmId)
  if (!film) throw new Error(`No film with id "${props.filmId}". See src/films.ts.`)

  return {
    durationInFrames: frames(film.duration, FPS),
    props: { ...props, musicStart: await filmMusicStart(film, FPS) },
  }
}

export function Root() {
  return (
    <>
      <Composition
        id="Launch-Vertical"
        component={LaunchVideo}
        calculateMetadata={fromTheMusic}
        durationInFrames={totalFrames(FPS)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="Launch-Landscape"
        component={LaunchVideo}
        calculateMetadata={fromTheMusic}
        durationInFrames={totalFrames(FPS)}
        fps={FPS}
        width={1920}
        height={1080}
      />

      {/* The run-up, in the order it posts. Registered from the list rather
          than written out, so adding a film is one entry in src/films.ts. */}
      {FILMS.map((film) => (
        <Fragment key={film.id}>
          <Composition
            id={`${film.id}-Vertical`}
            component={FilmVideo}
            calculateMetadata={filmMetadata}
            defaultProps={{ filmId: film.id, musicStart: 0 }}
            durationInFrames={frames(film.duration, FPS)}
            fps={FPS}
            width={1080}
            height={1920}
          />
          <Composition
            id={`${film.id}-Landscape`}
            component={FilmVideo}
            calculateMetadata={filmMetadata}
            defaultProps={{ filmId: film.id, musicStart: 0 }}
            durationInFrames={frames(film.duration, FPS)}
            fps={FPS}
            width={1920}
            height={1080}
          />
        </Fragment>
      ))}

      <Composition
        id="Act-Armory-Vertical"
        component={Armory}
        calculateMetadata={armoryFromTheMusic}
        durationInFrames={frames(ARMORY.duration, FPS)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="Act-Armory-Landscape"
        component={Armory}
        calculateMetadata={armoryFromTheMusic}
        durationInFrames={frames(ARMORY.duration, FPS)}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="Act-Hook"
        component={Hook}
        durationInFrames={FPS * 8}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="Act-Cinematic"
        component={Cinematic}
        durationInFrames={frames(CINEMATIC.duration, FPS)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="Act-EndCard"
        component={EndCard}
        durationInFrames={FPS * 6}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  )
}
