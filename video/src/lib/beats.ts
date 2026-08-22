import type { Time } from './zoom'

/** One line of the turn, and how long it holds the frame alone. */
export interface Beat {
  line: string
  hold: Time
  /**
   * `ask` sets something up and is set in the body colour. `answer` pays it
   * off, is a size larger, and wears the butter yellow the site reserves for
   * a character's own name — so the third line reads as a reply rather than
   * as a third statement.
   */
  tone: 'ask' | 'answer'
}
