import { CLASS_GEAR, ITEM_LEVEL_BANDS, ITEM_LEVEL_TOP_SPAN, RARITY_BY_NAME, SLOTS } from './tuning'
import type {
  CharacterClass,
  EmptyReason,
  EquipmentInput,
  EquippedItem,
  EquippedSlot,
  FounderAggregate,
  ItemDef,
  ItemVariant,
  Rarity,
  SlotDef,
} from './types'

/**
 * The paper doll. Founder in, seventeen slots out.
 *
 * Plumbing only: every threshold, every name and every slot-to-stat mapping
 * lives in tuning.ts, and this file is the fifty lines that walk them. If a
 * rebalance needs an edit here, the split has gone wrong — see the header of
 * tuning.ts.
 *
 * Pure, total, and order-stable: always seventeen entries, always in the
 * reference's own order, so the grid never reflows between two founders.
 */
export function equipmentFor(input: EquipmentInput): EquippedSlot[] {
  return SLOTS.map((slot) => equipSlot(slot, input))
}

function equipSlot(slot: SlotDef, input: EquipmentInput): EquippedSlot {
  const value = slot.read(input)
  const base = { slot: slot.key, label: slot.label, stat: slot.stat, glyph: slot.glyph }

  // Never told. Not the same fact as "told, and it is small".
  if (value === null || !Number.isFinite(value)) {
    return { ...base, item: null, empty: 'unreported' satisfies EmptyReason }
  }

  const worn = highestWearable(slot.items, value)
  if (worn === null) {
    return { ...base, item: null, empty: 'unearned' satisfies EmptyReason }
  }

  return { ...base, item: describe(slot, worn, value, input.characterClass), empty: null }
}

/**
 * The best item whose floor the value clears.
 *
 * A linear scan rather than a search: five entries, and walking them keeps the
 * table readable in source order — the one property that matters when the table
 * is the thing contributors come to argue about.
 */
function highestWearable(items: readonly ItemDef[], value: number): ItemDef | null {
  let worn: ItemDef | null = null
  for (const item of items) {
    if (value >= item.min) worn = item
    else break
  }
  return worn
}

/**
 * The item as this class wears it.
 *
 * Falls back to the base entry whenever the slot does not vary, the class's
 * armour or weapon has no variant written for it, or the key is simply missing
 * — three different gaps that all mean the same thing here, and none of which
 * should ever leave a slot blank. A missing variant is a content gap; a crash
 * or a hole would be a bug.
 */
function wearAs(slot: SlotDef, item: ItemDef, characterClass: CharacterClass): ItemVariant {
  const base = { name: item.name, after: item.after, icon: item.icon }
  if (!slot.varyBy || !item.variants) return base

  const gear = CLASS_GEAR[characterClass]
  const key = slot.varyBy === 'armor' ? gear.armor : gear.weapon
  return item.variants[key] ?? base
}

function describe(
  slot: SlotDef,
  worn: ItemDef,
  value: number,
  characterClass: CharacterClass,
): EquippedItem {
  const index = slot.items.indexOf(worn)
  const upgrade = slot.items[index + 1] ?? null
  const wornAs = wearAs(slot, worn, characterClass)
  const nextAs = upgrade === null ? null : wearAs(slot, upgrade, characterClass)

  return {
    name: wornAs.name,
    icon: wornAs.icon,
    itemLevel: itemLevelOf(slot, worn, value),
    rarity: rarityOf(worn),
    value,
    valueLabel: slot.format(value),
    // What the next rung costs, in the slot's own units. A paper doll that only
    // reports is a table with pictures; this is the line that makes it a goal.
    next:
      upgrade === null || nextAs === null
        ? null
        : {
            name: nextAs.name,
            rarity: rarityOf(upgrade),
            min: upgrade.min,
            minLabel: slot.format(upgrade.min),
          },
  }
}

/**
 * Gold on an unknown tier, matching achievementRarityHex. Unreachable while the
 * table type-checks — RarityName is closed — and cheap insurance against a
 * hand-edited tuning file shipping a blank swatch.
 */
function rarityOf(item: ItemDef): Rarity {
  return RARITY_BY_NAME.get(item.rarity) ?? { name: item.rarity, hex: '#f8b700' }
}

/**
 * One piece's item level: its quality band, plus how far into that band the
 * stat has actually climbed.
 *
 * Logarithmic, not linear, and for the same reason the level table is: these
 * ladders span $1 to $100K and 1 product to 7 in the same five rungs. On a
 * linear scale a founder at $2K MRR and one at $9K would both round to the
 * bottom of the rare band, because $10K is the next rung and 2 and 9 are both
 * "near zero" beside it. Log spacing makes every doubling worth the same
 * distance, which is what the rest of this file already assumes.
 */
function itemLevelOf(slot: SlotDef, worn: ItemDef, value: number): number {
  const band = ITEM_LEVEL_BANDS[worn.rarity]
  const index = slot.items.indexOf(worn)
  const next = slot.items[index + 1]
  // The top rung has no ceiling to measure against, so one is invented — see
  // ITEM_LEVEL_TOP_SPAN.
  const ceiling = next ? next.min : Math.max(worn.min, 1) * ITEM_LEVEL_TOP_SPAN

  const lo = Math.log1p(Math.max(worn.min, 0))
  const hi = Math.log1p(Math.max(ceiling, 0))
  // A degenerate rung — floor equal to ceiling — puts the piece at the top of
  // its band rather than dividing by zero.
  const t = hi <= lo ? 1 : clamp((Math.log1p(Math.max(value, 0)) - lo) / (hi - lo), 0, 1)

  return Math.round(band.from + t * (band.to - band.from))
}

/**
 * The character's item level: the mean of what they are wearing.
 *
 * The game's own definition, and a straight replacement for the old one — MRR
 * projected over twelve months, which asked a single stat to speak for a whole
 * founder. Seventeen slots is the point of building a paper doll: a founder
 * with no revenue but a decade shipped, ten technologies and a real audience is
 * not item level 1, and the previous formula said they were.
 *
 * Empty slots are excluded, not counted as zero. The game counts them, because
 * an empty slot in the game means you took the item off; here it means TrustMRR
 * never filled the field, and averaging in a zero for that would be the same
 * mistake the retention penalty has already been corrected for twice.
 *
 * Null when nothing at all is worn, which is the honest answer for a founder
 * the corpus says nothing about.
 */
export function ilvlFromDoll(slots: EquippedSlot[]): number | null {
  const levels = slots.map((s) => s.item?.itemLevel).filter((v): v is number => v !== undefined)
  if (levels.length === 0) return null
  return Math.round(levels.reduce((sum, v) => sum + v, 0) / levels.length)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * How much of the doll is filled, as worn slots over seventeen.
 *
 * Deliberately counts BOTH kinds of empty against the total. The distinction
 * between "unreported" and "unearned" is the right one to draw in a tooltip and
 * the wrong one to draw here: a founder cannot tell which of their slots are
 * blank because TrustMRR is thin, and a completion figure that quietly forgave
 * the thin ones would drift up without anybody shipping anything.
 */
export function equipmentScore(slots: EquippedSlot[]): { worn: number; total: number } {
  return { worn: slots.filter((s) => s.item !== null).length, total: slots.length }
}

/**
 * The aggregate carries every stat the doll reads. Only the class comes from
 * outside it, because `classFrom` is what decides that and it runs first.
 */
export function equipmentInput(
  aggregate: FounderAggregate,
  characterClass: CharacterClass,
): EquipmentInput {
  return { ...aggregate, characterClass }
}
