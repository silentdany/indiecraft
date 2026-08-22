import { ARMORY } from '../edit'
import { Sheet } from '../shots/Sheet'
import { Shot } from './Shot'

/**
 * The character sheet, as the launch video films it.
 *
 * A named act rather than an inline Shot, because the launch video's structure
 * reads as four acts and one of them should not be spelled `<Shot stops={…}>`
 * in the middle of it. The films in the run-up compose Shot directly; they
 * have no acts.
 */
export function Armory() {
  return (
    <Shot stops={ARMORY.stops} captions={ARMORY.captions}>
      <Sheet />
    </Shot>
  )
}
