import { ImageResponse } from '@vercel/og'
import { BrandMark, MARK_GROUND } from '@/components/brand-mark'

export const runtime = 'nodejs'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/*
 * The ground is a deep navy rather than the site's warm #170e09.
 *
 * Deliberate divergence, not drift: a favicon is 16px in a strip of other
 * favicons, and the brown reads as near-black beside them — the mark loses its
 * edge and the tab becomes one more dark square. A blue ground separates it
 * from the page it opens and lets the gold sit forward, which is the whole job
 * of the icon. The reference does the same thing for the same reason.
 *
 * Both icon routes carry it; nothing else on the site changes ground.
 */
// The same navy the mark carries inside its ring, so the disc and the plate
// behind it can never drift apart.
const GROUND = MARK_GROUND

/** Same mark, the size iOS asks for. */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: GROUND,
      }}
    >
      <BrandMark size={140} color="#f8b700" />
    </div>,
    size,
  )
}
