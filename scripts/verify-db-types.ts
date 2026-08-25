/**
 * Checks the two halves of the `fetch_types: false` trade on a live server.
 *
 *   pnpm verify-db-types
 *
 * The pooled client turns off postgres.js's array-type introspection, because
 * that one query was 85% of this project's database egress — 498,637
 * executions returning 177,014,595 rows, one per socket, forty times more rows
 * than every application query put together. lib/db.ts tells the whole story.
 *
 * The trade has a price, and it is the kind that fails in production and
 * nowhere else: without the fetched OIDs, an array passed as a parameter is
 * still tagged text[] and then serialised as `a,b` rather than `{a,b}`, so
 * `= any(${list})` dies at the server with 22P02. A type-check will not see it.
 * A unit test cannot see it either — the bug lives on the wire, in bytes the
 * client sends, so only a real Postgres can answer.
 *
 * So this asserts both halves:
 *   1. the pg_type scan does NOT run, on a first connection or a reconnect
 *   2. `in ${sql(list)}` works, `= any(${list})` fails, and every scalar this
 *      codebase reads still parses
 *
 * Networked and stateful on purpose, and therefore NOT a vitest file — same
 * reasoning as verify-icons: the suite runs offline, and this needs a server.
 *
 * Strictly read-only. No DDL, no writes, no table it did not find. Point it at
 * production if you like; it takes a fixture from `values (...)` rather than
 * from your data.
 */

import postgres from 'postgres'
import { POOLED_OPTIONS } from '../lib/db'

/** postgres.js's fetchArrayTypes, the query this whole exercise is about. */
const TYPE_SCAN = /pg_catalog\.pg_type/

let failures = 0

function check(name: string, pass: boolean, detail?: string) {
  if (!pass) failures++
  console.log(`  ${pass ? '✓' : '✗'} ${name}${pass || !detail ? '' : `\n      ${detail}`}`)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set. This check needs a real server.')
    process.exit(1)
  }

  const sent: string[] = []
  /*
   * The real options, imported rather than retyped, plus a debug hook and a
   * short idle timeout. The timeout is the only override and it is lowered, not
   * raised: the production symptom is the SECOND connection, so the check has
   * to be able to provoke one inside a few seconds.
   */
  const sql = postgres(url, {
    ...POOLED_OPTIONS,
    max: 1,
    idle_timeout: 1,
    debug: (_connection: unknown, query: string) => sent.push(query),
  })

  try {
    console.log('\nthe toll is gone')
    await sql`select 1 as x`
    const afterConnect = sent.filter((q) => TYPE_SCAN.test(q)).length
    // A reconnect, not a first connect: fetchArrayTypes caches its answer on
    // the client and re-runs anyway on the next socket, which is the entire
    // reason the bill was what it was.
    await sleep(1800)
    await sql`select 1 as x`
    const afterReconnect = sent.filter((q) => TYPE_SCAN.test(q)).length

    check('no pg_type scan on the first connection', afterConnect === 0, `saw ${afterConnect}`)
    check('no pg_type scan on a reconnect', afterReconnect === 0, `saw ${afterReconnect}`)

    console.log('\nthe price is paid where we expect it')
    const list = ['alice', 'carol']
    const fixture = sql`(values ('alice'), ('bob'), ('carol')) as t(handle)`

    const included = await sql<{ handle: string }[]>`
      select handle from ${fixture} where handle in ${sql(list)} order by handle
    `
    check(
      'an IN list is the shape that works',
      included.map((r) => r.handle).join(',') === 'alice,carol',
      JSON.stringify(included),
    )

    const single = await sql<{ handle: string }[]>`
      select handle from ${fixture} where handle in ${sql(['bob'])}
    `
    check('an IN list with one element', single.map((r) => r.handle).join(',') === 'bob')

    /*
     * Asserted as a FAILURE, deliberately.
     *
     * The constraint on db() is that no caller passes an array parameter, not
     * that postgres.js copes with one. The day this starts passing, either
     * fetch_types came back on — and the egress with it — or the library
     * changed, and either way lib/db.ts needs rereading before anything else.
     */
    let code: string | null = null
    try {
      await sql`select handle from ${fixture} where handle = any(${list})`
    } catch (error) {
      code = (error as { code?: string }).code ?? null
    }
    check(
      'an array parameter still fails with 22P02 — the constraint db() lives under',
      code === '22P02',
      code === null ? 'it succeeded, so fetch_types is back on' : `got ${code}`,
    )

    console.log('\nevery scalar this codebase reads still parses')
    const [row] = await sql<
      {
        n: number
        big: string
        exact: string
        at: Date
        day: Date
        flag: boolean
        payload: { a: number }
        missing: string | null
      }[]
    >`
      select 1::int as n, 9007199254740993::bigint as big, 1.25::numeric as exact,
             now() as at, current_date as day, true as flag,
             '{"a":1}'::jsonb as payload, null::text as missing
    `
    check('int → number', typeof row?.n === 'number')
    // Both stay strings, and that is the point: a bigint past 2^53 and a money
    // figure are exactly the two values a float would quietly round.
    check('bigint → exact string', row?.big === '9007199254740993', String(row?.big))
    check('numeric → exact string', row?.exact === '1.25', String(row?.exact))
    check('timestamptz → Date', row?.at instanceof Date)
    check('date → Date', row?.day instanceof Date)
    check('boolean → boolean', typeof row?.flag === 'boolean')
    check('jsonb → object', row?.payload?.a === 1)
    check('null → null', row?.missing === null)
  } finally {
    await sql.end({ timeout: 5 })
  }

  console.log(failures === 0 ? '\nall good\n' : `\n${failures} failed\n`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
