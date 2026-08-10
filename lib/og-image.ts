/**
 * Where a character's card lives, defined once.
 *
 * The `opengraph-image` file convention serves the image at
 * /c/<handle>/opengraph-image/<id>, where the id comes from that route's
 * `generateImageMetadata`. The bare path without an id is a 404.
 *
 * This existed implicitly in two places the moment the share block wanted to
 * show a preview: the route deciding the id, and the component guessing at it.
 * They agreed for about ten minutes. One definition, imported by both — and it
 * lives here rather than in the route because a client component importing a
 * route module would drag the whole renderer into the browser bundle.
 */

/** The two numbers that change, and therefore the two X must be made to re-fetch. */
export function ogImageId(level: number, ilvl: number | null): string {
  return `${level}-${ilvl ?? 'na'}`
}

export function ogImagePath(handle: string, level: number, ilvl: number | null): string {
  return `/c/${handle}/opengraph-image/${ogImageId(level, ilvl)}`
}
