import type { Beat } from './beats'
import type { Caption } from './captions'
import type { Time, ZoomStop } from './zoom'

/** Which of the app's pages a film points its camera at. */
export type ShotName = 'sheet' | 'ladder'

/**
 * One film in the run-up.
 *
 * Four of them share a grammar — footage, then copy, then a shot of the
 * product, then the name — and each one drops the parts it does not need. The
 * first drops everything but copy and the name; the third opens straight on
 * the product with no copy in front of it. What varies is which parts are
 * present, not how any part behaves, which is why they are one component and
 * not four.
 */
export interface Film {
  /** Composition id, minus the -Vertical / -Landscape suffix. */
  id: string
  /** The date it posts. Only ever used to name the output file. */
  posts: string
  /** One line, for whoever opens this file in three weeks. */
  about: string

  duration: Time

  /**
   * Footage at the head of the film, or none.
   *
   * `src` names a file in public/ and defaults to the cinematic. Films three
   * and four point it at gameplay clips instead: the same nostalgia hook, but
   * of somebody playing rather than of a rendered cutscene.
   *
   * `fit` and `focus` default to the cinematic's, which is right for a 2.20:1
   * scope frame and wrong for a near-square screen grab — see the gameplay
   * films, which override both.
   */
  sting?: {
    src?: string
    from: Time
    duration: Time
    fit?: 'cover' | 'contain'
    focus?: [number, number]
    backdrop?: boolean
  }

  /** Lines on black, before the shot. */
  beats?: Beat[]

  /** The page the camera films, and how it moves over it. */
  shot?: ShotName
  stops?: ZoomStop[]
  captions?: Caption[]

  /** The card. Always the lockup alone — these are not the launch video. */
  end: Time
}
