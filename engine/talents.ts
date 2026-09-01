import { arpuOf } from './aggregate'
import { MAX_LEVEL, TALENT_TREES_BY_CLASS, TALENTS } from './tuning'
import type {
  CharacterClass,
  FounderAggregate,
  TalentBuild,
  TalentTreeDef,
  TalentTreeKey,
} from './types'

/**
 * The talent build: three trees, one spec, `Fire 31/11/9`.
 *
 * Plumbing only, exactly like engine/equipment.ts. Every tree, every signal,
 * every saturation anchor and the level that grants the first point live in
 * TALENT_TREES and TALENTS. This file is the fifty lines that walk them, and if
 * a rebalance needs an edit here then the split has gone wrong — see the header
 * of tuning.ts.
 *
 * Pure, total, and order-stable: the three trees always come back in table
 * order, so the label a founder screenshots today reads the same tomorrow.
 */

/**
 * Points available at a level, which is also points spent.
 *
 * `level - 9`, the reference's own arithmetic: one at ten, fifty-one at sixty.
 * Clamped at both ends rather than trusted, because a level is a number that
 * arrives from a database column here and a negative point count would be an
 * allocator bug rather than a display one.
 */
export function pointsFor(level: number): number {
  if (!Number.isFinite(level)) return 0
  return Math.max(0, Math.min(Math.floor(level), MAX_LEVEL) - (TALENTS.firstPointAtLevel - 1))
}

/**
 * No class, or not yet level ten.
 *
 * A single frozen object rather than a fresh one per call: it is returned for
 * every Adventurer on every ladder page, it is immutable by construction, and
 * an empty build is the same empty build whoever asks for it.
 */
const NO_BUILD: TalentBuild = Object.freeze({
  points: 0,
  spec: null,
  specKey: null,
  trees: Object.freeze([]) as TalentBuild['trees'],
  label: '',
})

/**
 * The build. Aggregate in, three integers and a spec name out.
 *
 * The class arrives from the caller rather than being re-derived, for the same
 * reason `equipmentInput` takes it: `classFrom` owns that decision, compute
 * writes it down, and a sheet whose talents disagreed with the class printed
 * above them would be two answers to one question on one page.
 */
export function talentsFor(
  aggregate: FounderAggregate,
  characterClass: CharacterClass,
  level: number,
): TalentBuild {
  const def = TALENT_TREES_BY_CLASS.get(characterClass)
  const points = pointsFor(level)
  // Adventurer has no entry, and that is the whole of its talent story: it is
  // the state of having no class yet, so there is nothing to specialise in.
  if (!def || points === 0) return NO_BUILD

  const ctx = { level, arpu: arpuOf(aggregate) }
  const weights = def.trees.map((tree) => strength(tree.read(aggregate, ctx), tree))
  /*
   * Sharpened for the split, raw for the record.
   *
   * `weight` is reported as the normalised signal because that is what it says
   * it is; the apportionment runs on the same numbers under TALENTS.contrast,
   * which is what turns three respectable signals into a build somebody can
   * read rather than into three near-equal thirds. Zero stays zero under any
   * exponent, so a tree with no signal still takes no points.
   */
  const spent = allocate(
    points,
    weights.map((w) => w ** TALENTS.contrast),
  )

  const trees = def.trees.map((tree, i) => ({
    key: tree.key,
    name: tree.name,
    icon: tree.icon,
    points: spent[i] ?? 0,
    weight: weights[i] ?? 0,
  }))

  // Deepest wins, and a tie goes to the tree listed first — the same rule
  // CLASS_RULES uses for a first match, and the reason table order is written
  // down in tuning.ts rather than left to whoever edits the array next.
  let deepest = trees[0] as (typeof trees)[number]
  for (const tree of trees) if (tree.points > deepest.points) deepest = tree

  return {
    points,
    spec: deepest.name,
    specKey: deepest.key as TalentTreeKey,
    trees,
    // Table order, never sorted by size: `31/11/9` is only readable because the
    // columns are always the same three trees in the same three places.
    label: `${deepest.name} ${trees.map((t) => t.points).join('/')}`,
  }
}

/**
 * A raw signal, as a share of its tree's ceiling.
 *
 * Null becomes 0 weight and never becomes a point — the distinction the whole
 * engine turns on, and the reason `read` is allowed to return null at all. A
 * negative growth figure lands at 0 for a different reason and the difference
 * matters: it was reported, it simply earns nothing toward a tree about growth.
 *
 * Logarithmic wherever the tree says so, for the reason item levels are: these
 * ladders run $1 to $100K, and on a linear scale a founder at $2K and one at
 * $9K are both indistinguishable from zero beside the anchor.
 */
function strength(value: number | null, tree: TalentTreeDef): number {
  if (value === null || !Number.isFinite(value)) return 0
  const v = Math.max(value, 0)
  const full = Math.max(tree.full, 0)
  // A ceiling of zero is a table error rather than a founder's problem: anything
  // above nothing is a full tree, and nothing is an empty one.
  if (full === 0) return v > 0 ? 1 : 0
  return clamp(tree.log ? Math.log1p(v) / Math.log1p(full) : v / full, 0, 1)
}

/**
 * Split the points across three weights so the integers sum exactly.
 *
 * Largest remainder, which is the method used to apportion seats in a
 * parliament and is here for the same property: every point is spent, nobody is
 * rounded out of existence, and the answer does not depend on the order the
 * arithmetic happened to run in.
 *
 * Two guarantees worth stating, because both are the sort of thing that breaks
 * silently:
 *
 *   A tree of weight zero never receives a point. The leftover after flooring
 *   equals the sum of the fractional parts, so there are always at least as
 *   many trees with a fraction to spend on as there are points left over — a
 *   zero-weight tree, whose fraction is zero, is never reached.
 *
 *   All three weights at zero is the only case with no answer, and it takes the
 *   documented fallback: everything into the first tree. That is a safety net
 *   rather than a path anybody walks, because every class has at least one tree
 *   its own CLASS_RULE guarantees — see the header of section 9 in tuning.ts.
 */
function allocate(points: number, weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0)
  if (total <= 0) return weights.map((_, i) => (i === 0 ? points : 0))

  const exact = weights.map((w) => (points * w) / total)
  const out = exact.map((v) => Math.floor(v))
  let left = points - out.reduce((sum, v) => sum + v, 0)

  const byRemainder = exact
    .map((v, i) => ({ i, fraction: v - Math.floor(v) }))
    // Index breaks a tie, so two identical signals resolve by table order
    // rather than by whatever the sort implementation felt like.
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i)

  for (const { i } of byRemainder) {
    if (left <= 0) break
    out[i] = (out[i] ?? 0) + 1
    left--
  }
  return out
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
