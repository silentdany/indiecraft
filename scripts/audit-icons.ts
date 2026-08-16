/**
 * Checks that every item wears the icon its SOURCE item actually has.
 *
 *   pnpm audit-icons
 *
 * `verify-icons` asks whether a slug resolves. This asks the other question —
 * the one that let four wrong icons sit in production until somebody spotted
 * them by eye. `inv_weapon_shortblade_30` returns bytes and is not Kingsfall's
 * picture; `inv_hammer_20` returns bytes and is not Sulfuras. Every gate in this
 * repo passed both.
 *
 * The `after` field is what makes this automatable: each item names the real
 * thing it derives from, so the wiki can be asked what icon that thing wears.
 *
 * ---------------------------------------------------------------------------
 * Why warcraft.wiki.gg and not Wowhead.
 *
 * The first version of this used Wowhead's search suggestions, and it was worse
 * than useless: that endpoint ignores the /classic/ prefix, so `Ashbringer`
 * came back as the Legion artifact and the run reported 103 mismatches most of
 * which were retail items with our names. It also rate-limited the machine into
 * a 403 for a day.
 *
 * The wiki's item tooltip is version-aware — its Sulfuras page carries the
 * Classic icon AND the later remake, in that order — it answers with clean
 * JSON, it follows redirects, and it says `missingtitle` plainly for a name
 * that is not an item. Every mismatch below has to be judged by a person
 * anyway, so what matters is that the list is short and true.
 * ---------------------------------------------------------------------------
 *
 * Networked and third-party, so NOT a vitest file, same as its sibling: the
 * suite runs offline. Answers are cached to disk, so a second run costs nothing
 * and only new `after` names hit the network.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { iconCensus } from '../lib/icon-census'

/** Somebody else's wiki. One at a time, spaced out, and cache everything. */
const PAUSE_MS = 250
const CACHE_PATH = '.cache/wiki-icons.v2.json'
const UA = 'indiecraft-icon-audit/1.0 (paper doll icon verification; contact via repo)'

/** What the wiki knows about one source item. */
interface Lookup {
  /**
   * Every item tooltip on the page, as icon + the name that tooltip is FOR.
   *
   * Paired rather than a bare icon list, and that pairing is the guard: a wiki
   * page carries tooltips for neighbours and set pieces, so "the first icon on
   * the Rhok'delar page" could be Lok'delar's staff. Matching the tooltip's own
   * name against the item we asked about makes a mis-attribution impossible
   * rather than merely unlikely.
   */
  items: { icon: string; name: string }[]
  /** The page it actually landed on, after redirects. Null when there is none. */
  title: string | null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const cache: Record<string, Lookup> = (() => {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as Record<string, Lookup>
  } catch {
    return {}
  }
})()

function saveCache() {
  mkdirSync(dirname(CACHE_PATH), { recursive: true })
  writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`)
}

async function lookup(name: string): Promise<Lookup> {
  const hit = cache[name]
  if (hit) return hit

  const url = new URL('https://warcraft.wiki.gg/api.php')
  url.searchParams.set('action', 'parse')
  url.searchParams.set('page', TITLE_OVERRIDES.get(name) ?? name)
  url.searchParams.set('prop', 'text')
  // The lead section carries the item tooltip and is a sixth of the page.
  url.searchParams.set('section', '0')
  url.searchParams.set('redirects', '1')
  url.searchParams.set('formatversion', '2')
  url.searchParams.set('format', 'json')

  // 429 is not an error to report, it is an instruction to wait. The first run
  // of this hit the wall at 118 lookups and threw away everything after it.
  let res = await fetch(url, { headers: { 'user-agent': UA } })
  for (let wait = 2_000; res.status === 429 && wait <= 32_000; wait *= 2) {
    await sleep(wait)
    res = await fetch(url, { headers: { 'user-agent': UA } })
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as {
    error?: { code?: string }
    parse?: { title?: string; text?: string }
  }

  // `missingtitle` is not a failure: it is the answer "no item is called that",
  // which is true of most variant `after` names and worth reporting as its own
  // bucket rather than as a broken lookup.
  if (body.error) {
    const miss: Lookup = { items: [], title: null }
    cache[name] = miss
    return miss
  }

  const text = body.parse?.text ?? ''
  /*
   * One tooltip is `.tt-icon` holding a File: link, then `<li class="name">`
   * holding the item's name in a quality-coloured bold. Reading them as a pair
   * in one expression is what keeps them associated — the icon and the name it
   * belongs to cannot drift apart if the regex only matches them together.
   */
  const items = [
    ...text.matchAll(
      /tt-icon[^>]*>\s*<a href="\/wiki\/File:([A-Za-z0-9_]+)\.png[\s\S]{0,400}?<li class="name">[\s\S]{0,120}?<b>([^<]+)<\/b>/g,
    ),
  ].map((m) => ({ icon: m[1]!.toLowerCase(), name: m[2]!.trim() }))
  const found: Lookup = { items, title: body.parse?.title ?? null }
  cache[name] = found
  return found
}

/*
 * Items that knowingly do NOT wear their source item's icon, and why.
 *
 * WoW reuses art: Truestrike Shoulders and Dragonstalker's Spaulders are one
 * picture, Flameguard and Devilsaur Gauntlets are another. Two rungs of one
 * ladder sharing a picture means a founder cannot see themselves get an
 * upgrade, and that rule beats fidelity to a source item — so the higher rung
 * keeps the real icon and the lower one deviates. Listed here rather than
 * silently tolerated, because the next run would otherwise report them forever
 * and the fix would be to break the ladder.
 */
/*
 * Source items whose wiki page is not the item's page.
 *
 * `Crown of Destruction` is a boss ability first and a helm second, so the bare
 * title lands on a page with no item tooltip. The wiki's own disambiguation
 * suffix is the fix, and naming it here is cheaper than a fuzzy search that
 * would sometimes guess wrong silently.
 */
const TITLE_OVERRIDES = new Map<string, string>([
  ['Crown of Destruction', 'Crown of Destruction (item)'],
])

const DEVIATIONS = new Map<string, string>([
  [
    'Trueship Shoulders',
    "Truestrike shares its art with Dragonstalker's, which the epic rung wears",
  ],
  ['Framework Gauntlets', 'Flameguard shares its art with Devilsaur, which the rare rung wears'],
])

async function main() {
  /*
   * Base items only, and that is a statement about what `after` means.
   *
   * A base entry claims to derive from a real item and to wear its picture, so
   * the wiki can settle it. A VARIANT cannot be settled that way: the four
   * armour variants of one rung share one `after` and deliberately wear four
   * different pictures, because a plate wearer has to see a plate boot. Holding
   * them to the source item's icon would collapse all four into one and delete
   * the variant system — the icon there answers to the armour type, and the
   * `after` beside it is only where the words came from.
   *
   * Achievements, classes and factions are excluded for the plainer reason that
   * their `after` is a code, not something the wiki has an item page for.
   */
  const entries = iconCensus()
    .filter((section) => section.group === 'item')
    .flatMap((section) => section.entries)
    .filter((entry) => !entry.slot.includes('/'))

  const wrong: { name: string; after: string; ours: string; theirs: string[] }[] = []
  const noItem: { name: string; after: string }[] = []
  const noTooltip: { name: string; after: string; title: string }[] = []
  const failed: string[] = []
  const deviated: string[] = []
  let matched = 0

  for (const entry of entries) {
    const cached = entry.after in cache
    try {
      const { items, title } = await lookup(entry.after)
      // Only the tooltips that are actually FOR the item we asked about.
      const theirs = [
        ...new Set(
          items
            .filter((i) => i.name.toLowerCase() === entry.after.toLowerCase())
            .map((i) => i.icon),
        ),
      ]
      if (title === null) noItem.push({ name: entry.name, after: entry.after })
      else if (theirs.length === 0) noTooltip.push({ name: entry.name, after: entry.after, title })
      else if (theirs.includes(entry.icon)) matched++
      else if (DEVIATIONS.has(entry.name)) deviated.push(entry.name)
      else wrong.push({ name: entry.name, after: entry.after, ours: entry.icon, theirs })
    } catch (error) {
      failed.push(`${entry.after}: ${error instanceof Error ? error.message : 'error'}`)
    }
    // Only pace the ones that actually went out. A cached run is instant.
    if (!cached) await sleep(PAUSE_MS)
  }
  saveCache()

  const checked = matched + wrong.length
  console.log(`${matched}/${checked} checkable icons match  (${entries.length} items total)`)

  if (wrong.length > 0) {
    console.log(`\n${wrong.length} wearing an icon their source item does not have:`)
    for (const w of wrong.sort((a, b) => a.after.localeCompare(b.after))) {
      console.log(
        `  ${w.name}\n    ← ${w.after}\n    ours ${w.ours}   wiki ${w.theirs.join(' / ')}`,
      )
    }
  }

  /*
   * Not a bug list. A variant's `after` is often a name invented to parallel the
   * base item — there is no "Patched Mail Pants" in the game — and an icon with
   * no real source item to be wrong about is simply a free choice. Printed as a
   * count, and behind a flag, because the alternative is a hundred lines of
   * noise above the four that matter.
   */
  if (noItem.length > 0) {
    console.log(`\n${noItem.length} whose source item does not exist, so nothing to check.`)
    if (process.argv.includes('--all')) {
      for (const u of noItem.sort((a, b) => a.after.localeCompare(b.after))) {
        console.log(`  ${u.after.padEnd(46)} ${u.name}`)
      }
    }
  }

  if (deviated.length > 0) {
    console.log(`\n${deviated.length} deliberately not wearing their source's icon:`)
    for (const name of deviated) console.log(`  ${name.padEnd(24)} ${DEVIATIONS.get(name)}`)
  }

  if (noTooltip.length > 0) {
    console.log(`\n${noTooltip.length} whose page carries no item tooltip — check by hand:`)
    for (const u of noTooltip.sort((a, b) => a.after.localeCompare(b.after))) {
      console.log(`  ${u.after.padEnd(46)} → ${u.title}`)
    }
  }

  if (failed.length > 0) console.log(`\n${failed.length} lookups failed:\n  ${failed.join('\n  ')}`)

  if (wrong.length > 0) process.exitCode = 1
  else console.log('\n✓ every checkable item wears its source item’s picture')
}

main().catch((error) => {
  saveCache()
  console.error(error)
  process.exit(1)
})
