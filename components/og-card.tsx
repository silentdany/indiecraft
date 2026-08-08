import { BrandMark } from '@/components/brand-mark'

/**
 * The shared skeleton behind every OG image on the site.
 *
 * Four routes render one of these, and before this existed the palette was
 * about to be hand-copied into each of them. Satori has no CSS variables, so
 * the values below are the one permitted duplication of app/globals.css —
 * change one, change both, and change it here rather than in four places.
 *
 * Two Satori rules that are not optional and are not obvious:
 *   - every element with children needs an explicit `display: flex`;
 *   - a React fragment cannot be rendered at all. Multi-shape SVG goes in a
 *     <g>, which is why components/icon.tsx is written the way it is.
 */

export const OG = {
  bg: '#170e09',
  panel: '#1a120c',
  well: '#100a06',
  gold: '#f8b700',
  butter: '#fff468',
  text: '#ede7dc',
  muted: '#9b9187',
  frame: '#6b552a',
} as const

export const OG_SIZE = { width: 1200, height: 630 }

/**
 * The frame, the panel and the signature — everything a card carries whatever
 * it is about. The border colour is the one thing callers change: a character
 * card takes its quality colour, the rest of the site takes gold.
 */
export function OgCard({
  accent = OG.gold,
  signature = true,
  children,
}: {
  accent?: string
  /** Off when the wordmark IS the content, so it is not printed twice. */
  signature?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: OG.bg,
        border: `10px solid ${accent}`,
        fontFamily: 'Cinzel',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          margin: 24,
          padding: '38px 46px 28px',
          background: OG.panel,
          border: `2px solid ${OG.frame}`,
        }}
      >
        {children}
        {signature && <OgSignature />}
      </div>
    </div>
  )
}

/**
 * Never arrive anonymous.
 *
 * An OG image is seen by people who have no idea what this site is; a card with
 * no mark on it is a handsome picture of nothing. This is most of the reason
 * the images are worth rendering at all.
 */
export function OgSignature() {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <BrandMark size={30} color={OG.gold} />
      <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 11 }}>
        <div style={{ display: 'flex', fontSize: 11, color: OG.frame, letterSpacing: 5 }}>
          WORLD OF
        </div>
        <div style={{ display: 'flex', fontSize: 19, color: OG.gold, letterSpacing: 3 }}>
          INDIECRAFT
        </div>
      </div>
    </div>
  )
}
