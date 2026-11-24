import { describe, expect, it } from 'vitest'
import { batchesFor, MAX_BIND_PARAMETERS } from './batch'

describe('batchesFor', () => {
  it('splits the startups upsert that broke compute on 2026-09-29', () => {
    // Six columns, and a corpus past the point one statement can carry.
    const columns = 6
    const rows = Array.from({ length: 12_000 }, (_, i) => i)
    expect(rows.length * columns).toBeGreaterThan(MAX_BIND_PARAMETERS)

    const batches = batchesFor(rows, columns)
    for (const batch of batches) {
      expect(batch.length * columns).toBeLessThanOrEqual(MAX_BIND_PARAMETERS)
    }
    expect(batches.flat()).toEqual(rows)
  })

  it('keeps a wide table under the cap when rows per statement would not', () => {
    const batches = batchesFor(
      Array.from({ length: 10 }, (_, i) => i),
      4,
      12,
    )
    expect(batches.map((b) => b.length)).toEqual([3, 3, 3, 1])
  })

  it('caps narrow tables at 1,000 rows a statement', () => {
    const batches = batchesFor(
      Array.from({ length: 2_500 }, (_, i) => i),
      2,
    )
    expect(batches.map((b) => b.length)).toEqual([1_000, 1_000, 500])
  })

  it('sends nothing for nothing', () => {
    expect(batchesFor([], 6)).toEqual([])
  })

  it('refuses a width that cannot fit', () => {
    expect(() => batchesFor([1], 0)).toThrow(RangeError)
    expect(() => batchesFor([1], 10, 5)).toThrow(RangeError)
  })
})
