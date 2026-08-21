import type { Time } from './zoom'

/**
 * A line of copy, pinned to the seconds it is true for.
 *
 * Captions are timed against the shot they explain rather than laid out in a
 * sequence of their own, which is the whole idea: the viewer reads "lifetime
 * revenue is XP" while the camera is sitting on the 51. A claim and its proof
 * in one frame is understood; a claim on a black card and its proof two
 * seconds later is read twice and believed once.
 */
export interface Caption {
  /** When it appears, in seconds from the start of the act. */
  at: Time
  /** When it leaves. Give a long line more room than a short one. */
  until: Time
  /** `\n` breaks the line by hand rather than leaving it to the box width. */
  line: string
}
