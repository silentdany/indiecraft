import { wowIconUrl } from '@/lib/wow-icon'

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
/**
 * What the renderer can actually decode.
 *
 * `image/*` is not the test. Satori hands images to resvg, which knows PNG,
 * JPEG and GIF and nothing else — no AVIF, no WebP. A CDN doing `format=auto`
 * will happily answer with AVIF, the content type passes an `image/*` check,
 * and the whole card then 500s on a byte sequence the renderer cannot parse.
 *
 * That is exactly what happened: one founder's product icon came from a store
 * CDN as AVIF and their entire OG image stopped rendering — no card on any link
 * they shared, and a broken thumbnail in the share preview.
 */
const DECODABLE = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif']

/**
 * Ask an image CDN for a format we can read.
 *
 * `Accept` is the correct way and several CDNs ignore it, because the query
 * string wins: Lemon Squeezy serves `?format=auto` as AVIF no matter what the
 * header says. Overriding the parameter recovers a real logo instead of falling
 * back to a letter, and it is harmless anywhere the parameter means nothing.
 */
function preferDecodable(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.searchParams.has('format')) parsed.searchParams.set('format', 'png')
    return parsed.toString()
  } catch {
    return url
  }
}

export async function remoteImage(rawUrl: string | null): Promise<string | null> {
  if (!rawUrl) return null
  const url = preferDecodable(rawUrl)
  try {
    const response = await fetch(url, {
      // Ask for what we can read. A CDN negotiating on `format=auto` sends
      // AVIF to anything that does not say otherwise, so this alone fixes most
      // of it; the check below catches the ones that ignore the header.
      headers: { Accept: 'image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1' },
      signal: AbortSignal.timeout(2500),
    })
    if (!response.ok) return null
    const type = (response.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? ''
    if (!DECODABLE.includes(type)) {
      // Not an error worth failing the card over — the caller falls back to a
      // letter, which is a far better outcome than no image at all.
      console.warn(`[og] skipping undecodable ${type || 'unknown type'}: ${url.slice(0, 90)}`)
      return null
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    // An empty body renders as nothing; an enormous one is a decode nobody
    // asked for on a card that is 1200px wide.
    if (bytes.byteLength === 0 || bytes.byteLength > 3_000_000) return null
    return `data:${type};base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * A batch of Blizzard icons for a Satori card, keyed by slug.
 *
 * Every OG route that draws a class, a stat or a badge needs the same three
 * lines: dedupe the slugs, fetch them in parallel, and survive the ones that do
 * not answer. Written once here because five routes were about to write it five
 * times, and because a missing icon must degrade to the drawn glyph rather than
 * to a hole — see OgIcon.
 *
 * Deduplicated on purpose: a ladder card showing five founders of the same
 * class would otherwise fetch the same picture five times.
 */
export async function wowIcons(slugs: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(slugs.filter((s): s is string => Boolean(s)))]
  const fetched = await Promise.all(unique.map((slug) => remoteImage(wowIconUrl(slug))))
  const out = new Map<string, string>()
  unique.forEach((slug, i) => {
    const src = fetched[i]
    if (src) out.set(slug, src)
  })
  return out
}
