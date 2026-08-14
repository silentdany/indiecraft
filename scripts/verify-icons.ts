/**
 * Checks that every item in the equipment table points at an icon that exists.
 *
 *   pnpm verify-icons
 *
 * The table holds eighty-five hand-written slugs. A wrong one does not throw,
 * does not fail a type-check and does not fail a test — it renders as a hole in
 * somebody's paper doll, on production, silently. This script is the only thing
 * standing between "I am fairly sure Lionheart Helm is inv_helmet_25" and that
 * hole, so run it after touching any `icon:` field.
 *
 * Networked on purpose, and therefore NOT a vitest file: the suite has to run
 * offline and in CI without depending on Blizzard's CDN being up. Broken slugs
 * are a content error caught before commit, not a red build.
 */

import {
  ACHIEVEMENTS,
  CLASS_ICONS,
  EMPTY_SLOT_ICONS,
  FACTIONS,
  SLOTS,
  STAT_ICONS,
  UI_ICONS,
} from '../engine/tuning'
import { ICON_OK_STATUS, wowIconUrl } from '../lib/wow-icon'

/** Polite: the CDN owes us nothing, and eighty-five requests can wait. */
const CONCURRENCY = 6

interface Row {
  slot: string
  /** `${slotKey}:${rarity}` — the rung, shared by an item and all its variants. */
  tier: string
  name: string
  after: string
  icon: string
  status: number | string
}

async function head(url: string): Promise<number | string> {
  try {
    // GET with an aborted body rather than HEAD: the render host answers HEAD
    // with 403 even for slugs that exist, which would report every icon broken.
    const res = await fetch(url, { headers: { Range: 'bytes=0-0' } })
    return res.status
  } catch (error) {
    return error instanceof Error ? error.message : 'network error'
  }
}

async function main() {
  /*
   * Base entries and every class variant. The variants are the larger half now
   * and the easier half to get wrong — nobody looks at a Monk's fist weapon
   * unless they are a Monk, so a broken slug there could sit in production for
   * months without a single report.
   */
  const items: Omit<Row, 'status'>[] = SLOTS.flatMap((slot) =>
    slot.items.flatMap((item) => [
      {
        slot: slot.key,
        tier: `${slot.key}:${item.rarity}`,
        name: item.name,
        after: item.after,
        icon: item.icon,
      },
      ...Object.entries(item.variants ?? {}).map(([key, v]) => ({
        slot: `${slot.key}/${key}`,
        tier: `${slot.key}:${item.rarity}`,
        name: v.name,
        after: v.after,
        icon: v.icon,
      })),
    ]),
  )

  /*
   * Everything else the site borrows a picture for. Same reason as the items:
   * these are hand-written slugs, and a wrong one is a hole in a grid that no
   * type-check, test or build will ever complain about.
   */
  items.push(
    ...ACHIEVEMENTS.map((a) => ({
      slot: 'achievement',
      tier: `achievement:${a.code}`,
      name: a.label,
      after: a.code,
      icon: a.icon,
    })),
    ...Object.entries(CLASS_ICONS).map(([cls, icon]) => ({
      slot: 'class',
      tier: `class:${cls}`,
      name: cls,
      after: cls,
      icon,
    })),
    ...Object.entries(EMPTY_SLOT_ICONS).map(([glyph, icon]) => ({
      slot: 'empty',
      tier: `empty:${glyph}`,
      name: `empty ${glyph}`,
      after: glyph,
      icon,
    })),
    ...Object.entries(STAT_ICONS).map(([key, icon]) => ({
      slot: 'stat',
      tier: `stat:${key}`,
      name: key,
      after: key,
      icon,
    })),
    ...Object.entries(UI_ICONS).map(([key, icon]) => ({
      slot: 'ui',
      tier: `ui:${key}`,
      name: key,
      after: key,
      icon,
    })),
    ...FACTIONS.map((f) => ({
      slot: 'faction',
      tier: `faction:${f.key}`,
      name: f.key,
      after: f.key,
      icon: f.icon,
    })),
  )

  const results: Row[] = []
  let cursor = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < items.length) {
        const item = items[cursor++]!
        results.push({ ...item, status: await head(wowIconUrl(item.icon)) })
      }
    }),
  )

  // 206 as well as 200: the Range header above invites a partial response, and
  // a partial response is still proof the bytes are there.
  const ok = (s: number | string) => s === ICON_OK_STATUS || s === 206
  const broken = results.filter((r) => !ok(r.status))

  /*
   * Two slugs pointing at one picture is legal and usually a mistake.
   *
   * Scoped per slot on purpose now that variants exist: a Mage and a Warrior
   * never see each other's chest piece, so the same icon appearing in two
   * different slots is fine, while the same icon appearing twice inside one
   * slot means two rungs of one ladder look identical.
   */
  const seen = new Map<string, Set<string>>()
  for (const r of results) {
    const key = `${r.slot.split('/')[0]}:${r.icon}`
    seen.set(key, (seen.get(key) ?? new Set()).add(r.tier))
  }
  // Keyed on the RUNG, not the entry: an icon shared by the four armour
  // variants of one rung is the point, and an icon shared by two rungs of one
  // ladder means a founder cannot see themselves get an upgrade.
  const dupes = [...seen.entries()].filter(([, tiers]) => tiers.size > 1)

  console.log(`${results.length - broken.length}/${results.length} icons resolve`)

  if (dupes.length > 0) {
    console.log(`\n${dupes.length} icon(s) shared across rungs of one ladder:`)
    for (const [key, tiers] of dupes) console.log(`  ${key}  ${[...tiers].join(' · ')}`)
  }

  if (broken.length > 0) {
    console.log(`\n${broken.length} broken:`)
    for (const r of broken.sort((a, b) => a.slot.localeCompare(b.slot))) {
      console.log(
        `  [${r.status}] ${r.slot.padEnd(10)} ${r.icon.padEnd(30)} ${r.name}  ← ${r.after}`,
      )
    }
    process.exitCode = 1
    return
  }

  console.log('\n✓ every item has a picture')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
