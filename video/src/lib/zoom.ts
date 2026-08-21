/**
 * Where the camera looks, and when.
 *
 * A shot is a list of stops. Each one says "at this moment, over this long,
 * move to here at this magnification", and everything between two stops is
 * interpolated. Nothing else in the video positions a camera; if a shot needs
 * to move, it adds a stop.
 */

/** `"1:04.5"`, `"4.5"`, or a number — all meaning seconds. */
export type Time = number | string

export interface ZoomStop {
  /** When the move towards this stop begins. */
  at: Time
  /**
   * What to centre on. Either the id of an element marked `data-zoom="…"`
   * anywhere inside the shot, or an explicit [x, y] in fractions of the
   * content box. Defaults to the middle.
   *
   * The element form is the one to reach for: it is measured from the real
   * layout at render time, so a stop that says `to: 'ilvl'` keeps pointing at
   * the item level after somebody redesigns the panel it lives in.
   */
  to?: string | [number, number]
  /** 1 is untouched. 2.4 is a tight read on a single stat. */
  scale?: number
  /** How long the move takes. Default 0.8s. */
  for?: Time
  /**
   * `spring` overshoots a little and lands hard — right for punching in on a
   * number. `glide` is even and slow, for a drift across a wide shot.
   */
  ease?: 'spring' | 'glide'
}

/** Seconds, from any of the accepted spellings. */
export function seconds(time: Time): number {
  if (typeof time === 'number') return time

  const parts = time.split(':')
  if (parts.length > 2) {
    throw new Error(`Bad timecode "${time}": expected "m:ss.s" or a number of seconds.`)
  }

  const numbers = parts.map((part) => {
    const value = Number(part)
    if (!Number.isFinite(value)) {
      throw new Error(`Bad timecode "${time}": "${part}" is not a number.`)
    }
    return value
  })

  // Length is 1 or 2, so both reads below are populated.
  return numbers.length === 2
    ? (numbers[0] as number) * 60 + (numbers[1] as number)
    : (numbers[0] as number)
}

export const frames = (time: Time, fps: number): number => Math.round(seconds(time) * fps)

/** A resolved camera position: a focal point in fractions, and a magnification. */
export interface Camera {
  x: number
  y: number
  scale: number
}

export const WIDE: Camera = { x: 0.5, y: 0.5, scale: 1 }

/**
 * The transform that puts `camera` in the middle of a `width`×`height` frame.
 *
 * Written against a `transform-origin: 0 0` box, which is what makes this one
 * line of arithmetic instead of a fight with percentage origins: scale about
 * the top-left corner, then translate the focal point to the centre.
 *
 * Then clamped, which is the part that matters in practice. Aiming at the
 * page title asks the camera to centre something that sits 60px from the top
 * of a 4000px page, and obeying literally means half the frame is the void
 * above the document. Every real camera has this constraint — you cannot pan
 * past the edge of the set — so the shot slides back until the content covers
 * the frame, and the stop still reads as "look at the title".
 */
export function cameraTransform(
  camera: Camera,
  frame: { width: number; height: number },
  content: { width: number; height: number },
): string {
  const x = clamp(
    frame.width / 2 - camera.x * content.width * camera.scale,
    frame.width,
    content.width * camera.scale,
  )
  const y = clamp(
    frame.height / 2 - camera.y * content.height * camera.scale,
    frame.height,
    content.height * camera.scale,
  )
  return `translate(${x.toFixed(3)}px, ${y.toFixed(3)}px) scale(${camera.scale.toFixed(5)})`
}

/**
 * Keep one axis of the content covering the frame.
 *
 * The offset is negative as the camera moves further into the content, so the
 * legal range runs from `frame - scaled` (bottom/right edge flush) up to 0
 * (top/left edge flush). When the content is the smaller of the two there is
 * no covering position at all, and centring it is the only sane answer —
 * that is the case a wide shot of a short scene lands in.
 */
function clamp(offset: number, frame: number, scaled: number): number {
  if (scaled <= frame) return (frame - scaled) / 2
  return Math.min(0, Math.max(frame - scaled, offset))
}

/**
 * Blend two cameras.
 *
 * The focal point moves linearly, but the magnification moves geometrically —
 * `s0 * (s1/s0)^t` rather than a straight lerp. This is not a flourish: a
 * linear zoom from 1x to 4x spends its first half crossing 1x→2.5x and its
 * second half crossing 2.5x→4x, which the eye reads as a lurch that slams on
 * the brakes. Doubling every equal slice of time is what "smooth zoom" means.
 */
export function blend(from: Camera, to: Camera, t: number): Camera {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    scale: from.scale * (to.scale / from.scale) ** t,
  }
}
