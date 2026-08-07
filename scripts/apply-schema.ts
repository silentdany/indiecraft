/**
 * Applies db/schema.sql. Idempotent, replayable, no migration tool.
 *
 *   pnpm schema:apply              create whatever is missing
 *   pnpm schema:apply --reset      replay db/reset-derived.sql first
 *
 * `--reset` never touches snapshots. See db/reset-derived.sql.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { directDb } from '../lib/db'

/**
 * The two tables nothing can rebuild. `snapshots` because the API only returns
 * current state; `consent_events` because it records what people asked for.
 * A `--reset` that touches either is a bug, not a choice.
 */
const IRREPLACEABLE = ['snapshots', 'consent_events'] as const

async function main() {
  const reset = process.argv.includes('--reset')
  const sql = directDb()
  const dir = join(process.cwd(), 'db')

  try {
    if (reset) {
      const drop = await readFile(join(dir, 'reset-derived.sql'), 'utf8')
      const statements = stripComments(drop)
      for (const table of IRREPLACEABLE) {
        if (new RegExp(`\\b${table}\\b`).test(statements)) {
          throw new Error(`reset-derived.sql touches ${table} — refusing to run.`)
        }
      }
      await sql.unsafe(drop)
      console.log('✓ derived tables dropped')
    }

    await sql.unsafe(await readFile(join(dir, 'schema.sql'), 'utf8'))
    console.log('✓ schema applied')
  } finally {
    await sql.end()
  }
}

const stripComments = (source: string) => source.replace(/--.*$/gm, '')

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
