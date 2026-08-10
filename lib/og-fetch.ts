/**
 * A remote image, inlined as a data URI, or null.
 *
 * Satori will happily fetch a URL itself, and that is exactly the problem: its
 * fetch has no timeout and no content-type check, so a slow CDN hangs the
 * render, and TrustMRR's 403-as-XML answer for a missing logo throws inside the
 * renderer. Either one turns the most important image in the product into a 500
 * for that founder.
 *
 * Fetching here gives every failure the same shape — null — and every caller
 * falls back to a letter nobody will notice. Server-only, and deliberately in
 * its own file: lib/og-image.ts holds the URL helpers and is imported by a
 * client component, which must not drag `fetch`-and-Buffer code into the
 * browser bundle.
 */
export async function remoteImage(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2500) })
    if (!response.ok) return null
    const type = response.headers.get('content-type') ?? ''
    if (!type.startsWith('image/')) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    // An empty body renders as nothing; an enormous one is a decode nobody
    // asked for on a card that is 1200px wide.
    if (bytes.byteLength === 0 || bytes.byteLength > 3_000_000) return null
    return `data:${type};base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}
