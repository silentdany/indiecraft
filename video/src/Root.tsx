import { type CalculateMetadataFunction, Composition } from 'remotion'
import { ARMORY, CINEMATIC, FPS } from './edit'
import { actLengths, LaunchVideo, musicFrames, totalFrames } from './LaunchVideo'
import { frames } from './lib/zoom'
import { Armory } from './scenes/Armory'
import { Cinematic } from './scenes/Cinematic'
import { EndCard } from './scenes/EndCard'
import { Hook } from './scenes/Hook'

/**
 * Two cuts of one edit, plus the acts on their own.
 *
 * The single-act compositions are not deliverables — they exist because
 * aiming a close-up means scrubbing the same four seconds twenty times, and
 * doing that inside the full video means waiting through the cinematic every
 * reload. Render the two at the top; work in the four underneath.
 */

/**
 * The length of the whole video, read off the music.
 *
 * `calculateMetadata` is the only place Remotion will wait for an answer
 * before it decides how long a composition is — everything else has to be
 * synchronous. It runs in a browser, in the studio and again in the headless
 * Chrome the renderer drives, which is why the reader in lib/media is a
 * browser-capable one.
 */
const fromTheMusic: CalculateMetadataFunction<Record<string, unknown>> = async () => ({
  durationInFrames: await musicFrames(FPS),
})

/**
 * The same, cut down to the armory's share.
 *
 * The working composition has to be the length the act will really be, or
 * every stop aimed in it is aimed against a timeline that does not exist in
 * the finished video.
 */
const armoryFromTheMusic: CalculateMetadataFunction<Record<string, unknown>> = async () => ({
  durationInFrames: actLengths(FPS, await musicFrames(FPS)).armory,
})

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
