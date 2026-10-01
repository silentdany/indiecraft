import { INSTANCES } from './tuning'
import type { BossProgress, FounderAggregate, InstanceProgress } from './types'

/**
 * Dungeons and the raid, read off a sheet that has already been scored.
 *
 * Nothing here writes back. A clear does not grant XP, move a level, change
 * a class, or touch an item level — those are `computeCharacter`'s answers,
 * and this function does not call it.
 *
 * A boss is down only when its metric is met. A wing is cleared only when
 * every boss is down and the founder's level has opened it. One difficulty,
 * and the list of bosses is the whole size of the wing.
 */
export function instancesFor(aggregate: FounderAggregate, level: number): InstanceProgress[] {
  return INSTANCES.map((def) => {
    const bosses: BossProgress[] = def.bosses.map((boss) => ({
      code: boss.code,
      name: boss.name,
      blurb: boss.blurb,
      stat: boss.stat,
      requirement: boss.requirement,
      icon: boss.icon,
      down: boss.test(aggregate),
      current: boss.read(aggregate),
      target: boss.min,
    }))
    const locked = level < def.requiredLevel
    return {
      code: def.code,
      kind: def.kind,
      name: def.name,
      blurb: def.blurb,
      requiredLevel: def.requiredLevel,
      difficulty: def.difficulty,
      icon: def.icon,
      locked,
      cleared: !locked && bosses.every((boss) => boss.down),
      bosses,
    }
  })
}
