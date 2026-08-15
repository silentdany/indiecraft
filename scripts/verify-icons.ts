/**
 * Checks that every item in the equipment table points at an icon that exists.
 *
 *   pnpm verify-icons
 *
 * The census holds 283 hand-written slugs. A wrong one does not throw,
 * does not fail a type-check and does not fail a test — it renders as a hole in
 * somebody's paper doll, on production, silently. This script is the only thing
 * standing between "I am fairly sure Lionheart Helm is inv_helmet_25" and that
 * hole, so run it after touching any `icon:` field.
 *
 * Networked on purpose, and therefore NOT a vitest file: the suite has to run
 * offline and in CI without depending on Blizzard's CDN being up. Broken slugs
 * are a content error caught before commit, not a red build.
 *
 * This answers half the question. A slug that resolves is not a slug that is
 * RIGHT — `inv_helmet_25` returns bytes whether or not it is the helm the name
 * promises — and no script can tell the difference. `/icons` is the other half:
 * the same census as pictures, laid out to be looked at. Run this, then look at
 * that.
 */

import { type IconEntry, iconCensusFlat } from '../lib/icon-census'
import { ICON_OK_STATUS, wowIconUrl } from '../lib/wow-icon'

/** Polite: the CDN owes us nothing, and 283 requests can wait. */
const CONCURRENCY = 6

type Row = IconEntry & { status: number | string }

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
   * The census is shared with `/icons`, which shows the same list as pictures.
   * Two questions, one enumeration: this script asks whether a slug RESOLVES,
   * the page asks whether it is the RIGHT picture. Keeping the list in one
   * place is what stops a slug from falling between them.
   */
  const items = iconCensusFlat()

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
