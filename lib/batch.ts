/**
 * Postgres caps one statement at 65,535 bind parameters, and postgres.js
 * refuses anything above 65,534 before it reaches the server
 * (MAX_PARAMETERS_EXCEEDED). A multi-row insert binds rows x columns, so the
 * row count a statement can carry depends on how wide the table is.
 *
 * The `startups` upsert binds six columns and went out as one statement, so
 * past 10,922 listings it crossed the cap on its own, and `founder_startups`
 * did the same at three columns. Once a compute fails there, nothing after it
 * runs: no sheet moves and the site does not say so.
 */
export const MAX_BIND_PARAMETERS = 65_534

/** Rows per statement when the table is narrow: keeps each round trip small. */
export const MAX_ROWS_PER_STATEMENT = 1_000

/** Splits rows so that no statement binds more than `limit` parameters. */
export function batchesFor<T>(
  rows: readonly T[],
  columns: number,
  limit: number = MAX_BIND_PARAMETERS,
): T[][] {
  if (!Number.isInteger(columns) || columns < 1) {
    throw new RangeError(`columns must be a positive integer, got ${columns}`)
  }
  const size = Math.min(MAX_ROWS_PER_STATEMENT, Math.floor(limit / columns))
  if (size < 1) throw new RangeError(`${columns} columns cannot fit in ${limit} parameters`)
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}
