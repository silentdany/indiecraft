import { ALL_FORMATS, Input, UrlSource } from 'mediabunny'

/**
 * How long a file in public/ actually is.
 *
 * Read from the file rather than written down, because the one number this
 * video's length depends on is the one nobody would remember to update. Swap
 * the excerpt for a longer take and the cut follows it.
 *
 * Runs inside `calculateMetadata`, which Remotion evaluates in a browser — in
 * the studio and again in the headless Chrome the renderer drives — so this
 * has to be a browser-capable reader. Mediabunny is; it is also what Remotion
 * now points at, `@remotion/media-utils` having deprecated its own.
 */
export async function durationInSeconds(src: string): Promise<number> {
  const input = new Input({ source: new UrlSource(src), formats: ALL_FORMATS })
  return await input.computeDuration()
}
