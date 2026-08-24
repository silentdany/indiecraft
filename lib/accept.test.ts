import { describe, expect, it } from 'vitest'
import { preferredType } from './accept'

describe('preferredType', () => {
  it('serves HTML to a client that sends no Accept header at all', () => {
    expect(preferredType(null)).toBe('text/html')
  })

  it('serves HTML to a browser', () => {
    expect(preferredType('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')).toBe(
      'text/html',
    )
  })

  it('serves markdown when the agent asks for it', () => {
    expect(preferredType('text/markdown')).toBe('text/markdown')
  })

  it('breaks an equal-q tie on the order the client listed', () => {
    expect(preferredType('text/markdown, text/html')).toBe('text/markdown')
    expect(preferredType('text/html, text/markdown')).toBe('text/html')
  })

  it('honours q-values over list order', () => {
    expect(preferredType('text/html;q=0.5, text/markdown;q=0.9')).toBe('text/markdown')
    expect(preferredType('text/markdown;q=0.2, text/html;q=0.8')).toBe('text/html')
  })

  it('treats a bare wildcard as the browser case', () => {
    expect(preferredType('*/*')).toBe('text/html')
    expect(preferredType('text/*')).toBe('text/html')
  })

  /*
   * RFC 9110 § 12.5.1: a more specific range wins over a wildcard whatever the
   * q-values say. Without this an agent that says "anything but HTML" gets HTML.
   */
  it('lets an explicit q=0 override a wildcard that would otherwise match', () => {
    expect(preferredType('text/html;q=0, */*')).toBe('text/markdown')
  })

  it('returns null when the client rejects everything this site produces', () => {
    expect(preferredType('application/json')).toBeNull()
    expect(preferredType('image/png, image/webp')).toBeNull()
  })

  it('ignores a malformed q instead of dropping the entry', () => {
    expect(preferredType('text/markdown;q=banana')).toBe('text/markdown')
  })

  it('is case-insensitive about the media type', () => {
    expect(preferredType('TEXT/MARKDOWN')).toBe('text/markdown')
  })
})
