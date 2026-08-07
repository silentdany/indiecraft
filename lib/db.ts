import postgres from 'postgres'

// Supabase is only a Postgres host here. Never import supabase-js: a pg_dump
// must be enough to move to Neon, Railway, or anywhere else.

let pooled: postgres.Sql | undefined

/**
 * Pooled connection, for the Next app (Server Components and server routes).
 *
 * `prepare: false` is not an optimization, it is mandatory: pgbouncer in
 * transaction mode does not support prepared statements, and that is the bug
 * that fails silently in production.
 */
export function db(): postgres.Sql {
  if (!pooled) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    pooled = postgres(url, { prepare: false, max: 1 })
  }
  return pooled
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
