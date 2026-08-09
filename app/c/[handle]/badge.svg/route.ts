import { CLASS_COLORS, rarityFor } from '@/engine'
import { getCharacter } from '@/lib/queries'

/**
 * A self-updating badge, for a README or a site footer.
 *
 * The oldest growth loop on the internet and still the best one for this
 * audience: a founder drops one line of Markdown into a repo, and from then on
 * the badge shows their current level and links back here. It costs them
 * nothing, it updates itself nightly, and every placement is a real backlink
 * from a page a search engine already trusts.
 *
 * SVG rather than PNG, and hand-written rather than rendered through Satori:
 * GitHub serves README images through a proxy that strips scripts and caches
 * hard, the badge has to stay crisp at any DPI beside shields.io badges drawn
 * the same way, and at this size a raster of six words would be both heavier
 * and blurrier.
 *
 * Text width is estimated, not measured — there is no font metrics engine here
 * and the alternative is embedding one for a 20-pixel-tall image. See `widthOf`
 * for why the estimate errs generous.
 */
export const runtime = 'nodejs'
export const revalidate = 3600

const BG = '#170e09'
const FRAME = '#6b552a'
const GOLD = '#f8b700'
const MUTED = '#9b9187'

/** The size the text is drawn at, and therefore the size it is measured at. */
const FONT_SIZE = 11
const PAD = 13
/** Clear space between the class label and the iLvl, which used to be zero. */
const GAP = 14

export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const character = await getCharacter(handle).catch(() => null)

  // An opted-out or unknown founder gets a plain wordmark rather than a 404.
  // A broken image in somebody's README is a worse advertisement than a quiet
  // one, and a 404 there renders as a torn-page icon forever.
  const label = character
    ? `LEVEL ${character.level} ${character.characterClass.toUpperCase()}`
    : 'INDIECRAFT'
  const accent = character ? CLASS_COLORS[character.characterClass] : GOLD
  const ilvl = character?.ilvl ?? null
  const edge = character ? rarityFor(character.level).hex : FRAME

  const left = 'INDIECRAFT'
  const ilvlText = ilvl === null ? null : `ILVL ${ilvl}`

  /*
   * Every width is measured at FONT_SIZE, the size the text is actually drawn
   * at. The first version measured at 9 while rendering at 11, which is a
   * fifth too narrow: "PALADIN" and "ILVL 50" collided into "PALADINILVL 50",
   * and a short label like "MONK" ran through the right border. Two numbers
   * that must agree, so there is now one of them.
   */
  const leftWidth = Math.ceil(widthOf(left, FONT_SIZE)) + PAD * 2
  const labelWidth = widthOf(label, FONT_SIZE)
  const ilvlWidth = ilvlText === null ? 0 : widthOf(ilvlText, FONT_SIZE) + GAP
  const width = Math.ceil(leftWidth + PAD + labelWidth + ilvlWidth + PAD)
  const height = 28

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(`Indiecraft — ${label}`)}">
  <title>${escapeXml(character ? `${character.displayName} — ${label}` : 'World of Indiecraft')}</title>
  <rect width="${width}" height="${height}" fill="${BG}"/>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="${edge}"/>
  <rect x="${leftWidth}" y="1" width="1" height="${height - 2}" fill="${FRAME}"/>
  <g font-family="Georgia,'Times New Roman',serif" font-size="${FONT_SIZE}" letter-spacing="1.2">
    <text x="${PAD}" y="18" fill="${GOLD}">${escapeXml(left)}</text>
    <text x="${leftWidth + PAD}" y="18" fill="${accent}">${escapeXml(label)}</text>
    ${ilvlText === null ? '' : `<text x="${width - PAD}" y="18" fill="${MUTED}" text-anchor="end">${escapeXml(ilvlText)}</text>`}
  </g>
</svg>`

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // An hour at the edge, a day of staleness tolerated. GitHub's image proxy
      // caches aggressively on its own, so a shorter TTL here buys nothing and
      // a longer one would leave a level-up invisible for a week.
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}

/**
 * Roughly how wide a string renders, in pixels, at a given size.
 *
 * The badge has no access to font metrics, so this leans on the fact that the
 * label is uppercase serif with generous letter-spacing and averages a little
 * over half the font size per character. It deliberately over-estimates: text
 * that overflows its box looks broken, whereas a few pixels of extra padding
 * looks like padding.
 */
function widthOf(text: string, fontSize: number): number {
  let units = 0
  for (const char of text) {
    if (char === ' ') units += 0.34
    else if ('IJl1ijt'.includes(char)) units += 0.46
    else if ('MW'.includes(char)) units += 1.02
    else units += 0.8
  }
  // The 1.2 is the letter-spacing set on the <g>, which the em estimate above
  // knows nothing about and which adds up fast on a sixteen-character label.
  return units * fontSize + text.length * 1.2
}

/** The display name is user data and goes into the <title>. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
