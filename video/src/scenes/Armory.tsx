import { AbsoluteFill, useVideoConfig } from 'remotion'
import { CaptionBand } from '../components/CaptionBand'
import { ZoomPan } from '../components/ZoomPan'
import { ARMORY } from '../edit'
import { Sheet } from '../shots/Sheet'

/** The layout width of `.page` in globals.css. The sheet is drawn at this and scaled up. */
const SHEET_WIDTH = 960

/**
 * The product, filmed.
 *
 * The stops in edit.ts are written in multiples of "the sheet fills the frame
 * width", and this is where that is turned into a real magnification. It is
 * the whole reason one edit serves both aspect ratios: `scale: 2.6` means the
 * same thing to a 1080-wide vertical post and a 1920-wide landscape one, where
 * a raw CSS scale would have meant two different shots.
 */
export function Armory() {
  const { width } = useVideoConfig()
  const fill = width / SHEET_WIDTH

  const stops = ARMORY.stops.map((stop) => ({
    ...stop,
    scale: (stop.scale ?? 1) * fill,
  }))

  return (
    <AbsoluteFill style={{ background: 'var(--ic-bg)' }}>
      <ZoomPan stops={stops} contentWidth={SHEET_WIDTH}>
        <Sheet />
      </ZoomPan>
      {/* Outside the camera, and after it in the tree so it paints on top. A
          caption that zoomed with the sheet would be furniture in the shot
          rather than a voice over it. */}
      <CaptionBand captions={ARMORY.captions} />
    </AbsoluteFill>
  )
}
