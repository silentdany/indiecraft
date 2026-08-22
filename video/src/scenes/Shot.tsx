import type { ReactNode } from 'react'
import { AbsoluteFill, useVideoConfig } from 'remotion'
import { CaptionBand } from '../components/CaptionBand'
import { ZoomPan } from '../components/ZoomPan'
import type { Caption } from '../lib/captions'
import type { ZoomStop } from '../lib/zoom'

/**
 * The layout width of `.page` in globals.css.
 *
 * Both pages the camera films lay out at this, and the shot is scaled up from
 * it rather than rendered at frame size — which is what keeps a close-up sharp
 * and what lets `scale: 1` mean the same thing in both aspect ratios.
 */
export const PAGE_WIDTH = 960

/**
 * A page of the app, filmed and captioned.
 *
 * The stops arrive in multiples of "the page fills the frame width", and this
 * is where that becomes a real magnification. It is the whole reason one edit
 * serves both cuts: `scale: 2.4` means the same thing to a 1080-wide vertical
 * post and a 1920-wide landscape one, where a raw CSS scale would have meant
 * two different shots.
 */
export function Shot({
  stops,
  captions = [],
  children,
}: {
  stops: readonly ZoomStop[]
  captions?: Caption[]
  children: ReactNode
}) {
  const { width } = useVideoConfig()
  const fill = width / PAGE_WIDTH

  const scaled = stops.map((stop) => ({ ...stop, scale: (stop.scale ?? 1) * fill }))

  return (
    <AbsoluteFill style={{ background: 'var(--ic-bg)' }}>
      <ZoomPan stops={scaled} contentWidth={PAGE_WIDTH}>
        {children}
      </ZoomPan>
      {/* Outside the camera, and after it in the tree so it paints on top. A
          caption that zoomed with the page would be furniture inside the shot
          rather than a voice over it. */}
      <CaptionBand captions={captions} />
    </AbsoluteFill>
  )
}
