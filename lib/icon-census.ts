import type { IconName } from '@/components/icon'
import {
  ACHIEVEMENTS,
  CLASS_ICONS,
  EMPTY_SLOT_ICONS,
  FACTIONS,
  SLOTS,
  STAT_ICONS,
  UI_ICONS,
} from '@/engine/tuning'
import type { RarityName } from '@/engine/types'

/**
 * Every borrowed picture on the site, in one list.
 *
 * This used to live inside `scripts/verify-icons.ts`, which was fine while the
 * verifier was the only thing that needed it. It stopped being fine the moment
 * a second reader appeared: `/icons` and the verifier disagreeing about what
 * the census contains is the exact failure both of them exist to prevent —
 * a slug nobody checks because each tool assumed the other had it.
 *
 * So the enumeration is here and the two callers are thin. The verifier asks
 * whether each slug RESOLVES; the page asks whether each slug is the RIGHT
 * picture. Neither question can be answered by a type-check, and they are not
 * the same question: `inv_helmet_25` resolves whether or not it is the helm the
 * name promises.
 */
export interface IconEntry {
  /** `head`, `head/plate`, `achievement`, `class`, … — where it is worn. */
  slot: string
  /** `${slotKey}:${rarity}` — the rung, shared by an item and all its variants. */
  tier: string
  name: string
  /** The real thing the name derives from: a WoW item, or a code for the rest. */
  after: string
  icon: string
  /** Items only. Drives the frame colour on the contact sheet. */
  rarity?: RarityName
  /** What gets drawn when the CDN does not answer. */
  glyph: IconName
}

/** Groups in the order the contact sheet shows them. Items first, they are 85% of it. */
export const CENSUS_GROUPS = [
  'item',
  'achievement',
  'class',
  'faction',
  'empty',
  'stat',
  'ui',
] as const
export type CensusGroup = (typeof CENSUS_GROUPS)[number]

export interface CensusSection {
  group: CensusGroup
  /** `Head — Domain rating` for a slot, else the group's own name. */
  title: string
  /** Slot key for items, so the page can link a section to its ladder. */
  key: string
  entries: IconEntry[]
}

/**
 * The census, grouped the way it is worth looking at.
 *
 * One section per equipment slot rather than one big grid, because the mistake
 * this catches is relative: a legendary that looks scruffier than the rare
 * below it is obvious in a five-rung ladder and invisible in a wall of 283
 * squares. Rungs stay in table order — common first — for the same reason.
 */
export function iconCensus(): CensusSection[] {
  const sections: CensusSection[] = SLOTS.map((slot) => ({
    group: 'item' as const,
    key: slot.key,
    title: `${slot.label} — ${slot.stat}`,
    entries: slot.items.flatMap((item) => [
      {
        slot: slot.key,
        tier: `${slot.key}:${item.rarity}`,
        name: item.name,
        after: item.after,
        icon: item.icon,
        rarity: item.rarity,
        glyph: slot.glyph,
      },
      ...Object.entries(item.variants ?? {}).map(([key, v]) => ({
        slot: `${slot.key}/${key}`,
        tier: `${slot.key}:${item.rarity}`,
        name: v.name,
        after: v.after,
        icon: v.icon,
        rarity: item.rarity,
        glyph: slot.glyph,
      })),
    ]),
  }))

  sections.push(
    {
      group: 'achievement',
      key: 'achievement',
      title: 'Achievements',
      entries: ACHIEVEMENTS.map((a) => ({
        slot: 'achievement',
        tier: `achievement:${a.code}`,
        name: a.label,
        after: a.code,
        icon: a.icon,
        rarity: a.rarity,
        glyph: 'achievement' as IconName,
      })),
    },
    {
      group: 'class',
      key: 'class',
      title: 'Classes',
      entries: Object.entries(CLASS_ICONS).map(([cls, icon]) => ({
        slot: 'class',
        tier: `class:${cls}`,
        name: cls,
        after: cls,
        icon,
        glyph: 'crest' as IconName,
      })),
    },
    {
      group: 'faction',
      key: 'faction',
      title: 'Factions',
      entries: FACTIONS.map((f) => ({
        slot: 'faction',
        tier: `faction:${f.key}`,
        name: f.key,
        after: f.tagline,
        icon: f.icon,
        glyph: 'banner' as IconName,
      })),
    },
    {
      group: 'empty',
      key: 'empty',
      title: 'Empty slots',
      entries: Object.entries(EMPTY_SLOT_ICONS).map(([glyph, icon]) => ({
        slot: 'empty',
        tier: `empty:${glyph}`,
        name: glyph,
        after: glyph,
        icon,
        // The keys of EMPTY_SLOT_ICONS are the glyph names themselves, so the
        // fallback here is the very drawing the slot falls back to in the doll.
        glyph: glyph as IconName,
      })),
    },
    {
      group: 'stat',
      key: 'stat',
      title: 'Stats',
      entries: Object.entries(STAT_ICONS).map(([key, icon]) => ({
        slot: 'stat',
        tier: `stat:${key}`,
        name: key,
        after: key,
        icon,
        glyph: 'gear' as IconName,
      })),
    },
    {
      group: 'ui',
      key: 'ui',
      title: 'Interface',
      entries: Object.entries(UI_ICONS).map(([key, icon]) => ({
        slot: 'ui',
        tier: `ui:${key}`,
        name: key,
        after: key,
        icon,
        glyph: 'gear' as IconName,
      })),
    },
  )

  return sections
}

/** The flat list, for callers that only care about the slugs. */
export function iconCensusFlat(): IconEntry[] {
  return iconCensus().flatMap((s) => s.entries)
}
