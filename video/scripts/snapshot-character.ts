/**
 * Freeze one real character into JSON, so the video renders offline.
 *
 * The alternative — having the composition await getCharacter() — makes every
 * render depend on a database being up and on whatever the ladder happens to
 * look like that morning. A launch video is a fixed artefact: the numbers in
 * it should be the numbers somebody approved, and re-running this script is
 * the deliberate act of updating them.
 *
 *   pnpm snapshot            # whoever is rank 1 today
 *   pnpm snapshot leerob     # a specific handle
 */
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
const out = path.join(here, '..', 'src', 'data', 'character.json')

/**
 * Neutralise Next's cache layer before lib/queries is loaded.
 *
 * getCharacter is wrapped in `unstable_cache`, which asserts on an incremental
 * cache that only exists inside a request — outside `next dev` it throws
 * "Invariant: incrementalCache missing". There is nothing to cache in a script
 * that runs one query and exits, so the wrapper is replaced by the identity
 * function. This stays here rather than in lib/: the app wants that cache, and
 * a script is not a good reason to weaken it.
 *
 * Because the stub has to be in place *before* the import, lib/queries is
 * pulled in dynamically below instead of at the top of the file.
 */
const require_ = createRequire(import.meta.url)
const nextCacheId = require_.resolve('next/cache', { paths: [repoRoot] })
require_.cache[nextCacheId] = {
  id: nextCacheId,
  filename: nextCacheId,
  path: path.dirname(nextCacheId),
  loaded: true,
  children: [],
  paths: [],
  exports: {
    unstable_cache: <T>(fn: T) => fn,
    revalidateTag: () => undefined,
    revalidatePath: () => undefined,
    unstable_noStore: () => undefined,
  },
} as unknown as NodeJS.Module

type Db = typeof import('../../lib/db')['db']

async function topHandle(db: Db): Promise<string> {
  /*
   * Not simply "highest XP". The sheet has to be worth filming, and the top of
   * the ladder by raw XP is regularly somebody opted out (getCharacter returns
   * null for them, correctly) or a one-product founder whose paper doll is
   * mostly empty slots. Filled gear and a few achievements is what the video
   * is actually about, so that is what it sorts on.
   */
  const rows = await db()<{ handle: string }[]>`
    select c.handle
    from characters c
    join founders f on f.handle = c.handle
    where f.opted_out_at is null
      and c.ilvl is not null
      and c.n_products >= 2
    order by c.ilvl desc nulls last, c.xp desc
    limit 1
  `
  const first = rows[0]
  if (!first) throw new Error('No filmable character found — run `pnpm compute` first.')
  return first.handle
}

async function inlineImage(url: string | null): Promise<string | null> {
  if (!url) return null
  const response = await fetch(url)
  if (!response.ok) {
    console.warn(`Could not fetch the avatar (${response.status}); leaving the URL as-is.`)
    return url
  }
  const type = response.headers.get('content-type') ?? 'image/jpeg'
  const body = Buffer.from(await response.arrayBuffer()).toString('base64')
  return `data:${type};base64,${body}`
}

async function main() {
  const { db } = await import('../../lib/db')
  const { getCharacter } = await import('../../lib/queries')

  const handle = process.argv[2] ?? (await topHandle(db))
  const character = await getCharacter(handle)
  if (!character) throw new Error(`No character for handle "${handle}".`)

  /*
   * Inline the avatar as a data URI.
   *
   * It comes off pbs.twimg.com, and a render that reaches out to Twitter's CDN
   * for every frame is a render that fails at the worst moment — rate limited,
   * offline, or the account renamed its picture. Base64 costs about 20kB in
   * this file and buys a composition that renders with the network unplugged.
   */
  const frozen = { ...character, avatarUrl: await inlineImage(character.avatarUrl) }

  writeFileSync(out, `${JSON.stringify(frozen, null, 2)}\n`)
  console.log(
    `Wrote ${path.relative(process.cwd(), out)} — ${character.displayName}, ` +
      `level ${character.level} ${character.characterClass}, rank #${character.rank}.`,
  )
  await db().end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
