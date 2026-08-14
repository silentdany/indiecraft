import postgres from 'postgres'

// Supabase is only a Postgres host here. Never import supabase-js: a pg_dump
// must be enough to move to Neon, Railway, or anywhere else.

/**
 * The client is cached on globalThis, not in a module-level `let`.
 *
 * This is not defensive style, it is load-bearing. A module-scoped variable is
 * re-initialised every time Next re-evaluates the module — which dev does on
 * every hot reload, and which production does once per route bundle. Each
 * re-evaluation opened a new connection and abandoned the previous one, so the
 * pooler filled up and every page after the first hung until it timed out.
 * globalThis outlives module evaluation; the module variable does not.
 *
 * The flip side, and it has cost time twice: changing the options below does
 * nothing to a dev server that is already running. The cached client survives
 * hot reload precisely because that is its job, so a pool created with the old
 * `max` keeps serving until the process restarts. If a page starts hanging
 * right after you edit this file, restart `next dev` before believing anything
 * else.
 */
const globalForDb = globalThis as { __indiecraftDb?: postgres.Sql }

/**
 * Pooled connection, for the Next app (Server Components and server routes).
 *
 * `prepare: false` is not an optimization, it is mandatory: pgbouncer in
 * transaction mode does not support prepared statements, and that is the bug
 * that fails silently in production.
 *
 * `connect_timeout` matters just as much: without it a saturated pooler leaves
 * requests hanging indefinitely, and a page that hangs is far harder to
 * diagnose than a page that errors.
 *
 * ---------------------------------------------------------------------------
 * `max: 20`, and not the `max: 1` the spec calls for. Do not lower it back.
 *
 * With `max: 1`, any two queries awaited concurrently inside the Next server
 * runtime deadlock permanently. Measured, not guessed: the same `Promise.all`
 * that runs in 163 ms in a plain Node script never returns under `next start`,
 * while the identical queries run sequentially return in 141 ms. The first
 * page render of a process succeeds and every request after it hangs until it
 * times out, which reads exactly like a saturated database and is not one —
 * the database sat at 11 connections out of 60 throughout.
 *
 * Sequential call sites alone are not a sufficient fix, because concurrency is
 * not always ours to remove: Next runs `generateMetadata` and the page body of
 * the same route at the same time, and both read the character sheet.
 *
 * The number has to stay above the peak count of queries awaited concurrently
 * in a single render, and that peak is not obvious from any one file. It has
 * now caught us twice. First at 3, when a footer was added to the root layout
 * and took the armory front from three concurrent to four. Then at 8, when the
 * character sheet grew to six parallel reads: Next renders `generateMetadata`
 * and the page body at the same time, so the true peak is roughly double what
 * the source suggests.
 *
 * Both times the symptom was identical and misleading — requests hanging for
 * minutes on a page that had been instant, looking exactly like a saturated
 * database while the database sat at eleven connections out of sixty.
 *
 * So: headroom, and the rule stated rather than the number defended. Add a
 * parallel query to a page and this ceiling is the thing to check.
 *
 * ---------------------------------------------------------------------------
 * Lowered 20 -> 10 after it took production down. Read this before raising it.
 *
 * "Twenty per instance is still small for the serverless shape" was the line
 * that was wrong, and it was wrong about the wrong limit. Postgres was never
 * the constraint — it sat at 30 of 60 throughout the outage. Supavisor caps
 * CLIENT connections at 200, and a frozen Vercel instance keeps its sockets, so
 * the arithmetic is instances x max. At 20, ten instances is the whole budget,
 * and a handful of people clicking around a character sheet reaches it:
 * EMAXCONN on every route that touches the database, for four minutes, then
 * again as soon as traffic resumed.
 *
 * 10 is not a guess against the measurement above; it is the same rule applied
 * to a number that changed. The peak is one render's concurrent queries, and
 * that peak is getCharacter's Promise.all — six. The comment's "roughly double
 * what the source suggests" came from generateMetadata and the page body each
 * reading the sheet, and that stopped being true when getCharacter was wrapped
 * in React `cache`: both callers now share one invocation. Six, not twelve, so
 * ten carries the same 60% headroom twenty was chosen for.
 *
 * If this saturates again, the honest next move is Supabase's client limit, not
 * another notch off this number — below six it deadlocks, and that is measured.
 * ---------------------------------------------------------------------------
 */
export function db(): postgres.Sql {
  if (!globalForDb.__indiecraftDb) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    globalForDb.__indiecraftDb = postgres(url, {
      prepare: false,
      max: 10,
      // 5s, not 20: a socket returned four times faster is four times less of
      // the pooler's client budget held by an instance between renders.
      idle_timeout: 5,
      connect_timeout: 10,
    })
  }
  return globalForDb.__indiecraftDb
}

/**
 * Direct connection for the crawler: a long-lived process on GitHub Actions,
 * free of the pooler's restrictions. Never use this from the app.
 *
 * Note: Supabase's true direct endpoint (db.<ref>.supabase.co:5432) is
 * IPv6-only. GitHub Actions runners and most local setups are IPv4-only, so
 * DIRECT_URL should point at the *session* pooler
 * (aws-0-<region>.pooler.supabase.com:5432), which is IPv4 and still supports
 * prepared statements and long transactions.
 */
export function directDb(): postgres.Sql {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  if (!url) throw new Error('DIRECT_URL is not set')
  return postgres(url, { max: 4 })
}
