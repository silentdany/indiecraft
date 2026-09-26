import { describe, expect, it } from 'vitest'
import { parseHandle } from './handle'

describe('parseHandle', () => {
  it('accepts a bare handle', () => {
    expect(parseHandle('levelsio')).toBe('levelsio')
  })

  it('strips an @ and lowercases', () => {
    expect(parseHandle('@MajorBaguette')).toBe('majorbaguette')
  })

  it('takes the handle out of a profile URL', () => {
    expect(parseHandle('https://x.com/levelsio')).toBe('levelsio')
    expect(parseHandle('https://twitter.com/levelsio/status/1')).toBe('levelsio')
  })

  it('rejects anything that is not a handle', () => {
    expect(parseHandle('')).toBe('')
    expect(parseHandle('not a handle')).toBe('')
    expect(parseHandle('waytoolongtobeahandle')).toBe('')
    expect(parseHandle('../etc')).toBe('')
  })
})
