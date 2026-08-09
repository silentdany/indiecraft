'use client'

import { useState } from 'react'
import { capture } from './posthog-provider'

/**
 * The embeddable badge, offered near the foot of the sheet.
 *
 * It sat in the share row under the header, which was the wrong place twice
 * over: the share row is for the one action the product is measured on, and the
 * badge is a thing a founder sets up once and never looks at again. Everybody
 * else arriving on this page came to read a character sheet.
 *
 * The Markdown itself is deliberately not displayed. A one-line snippet in a
 * horizontally scrolling code box is an ugly object that also asks to be read,
 * and nobody reads it — they press the button. Showing the rendered badge and
 * handing over the snippet on copy says the same thing with one element instead
 * of two.
 */
export function BadgeBlock({
  handle,
  level,
  characterClass,
}: {
  handle: string
  level: number
  characterClass: string
}) {
  const [copied, setCopied] = useState<'md' | 'url' | null>(null)

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const src = `${origin}/c/${handle}/badge.svg`
  const markdown = `[![World of Indiecraft](${src})](${origin}/c/${handle})`

  async function copy(what: 'md' | 'url') {
    try {
      await navigator.clipboard.writeText(what === 'md' ? markdown : src)
      setCopied(what)
      capture('badge_copied', { handle, target: what })
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Refused on insecure origins and in some embedded views. Not worth an
      // alert: the badge URL is visible in the image itself.
    }
  }

  return (
    <div className="badgeblock">
      {/* biome-ignore lint/performance/noImgElement: the point is the raw endpoint, exactly as a README would embed it. */}
      <img
        className="badgeblock-preview"
        src={`/c/${handle}/badge.svg`}
        alt={`Level ${level} ${characterClass} badge`}
      />
      <div className="badgeblock-body">
        <p className="muted">
          Drop this in a README or a site footer. It updates itself every night and links back to
          this sheet.
        </p>
        <div className="badgeblock-actions">
          <button type="button" className="share-copy label" onClick={() => copy('md')}>
            {copied === 'md' ? 'Copied' : 'Copy Markdown'}
          </button>
          {/* For anywhere Markdown is not the format: a site footer, an HTML
              <img>, a Notion embed. */}
          <button type="button" className="share-copy label" onClick={() => copy('url')}>
            {copied === 'url' ? 'Copied' : 'Copy image URL'}
          </button>
        </div>
      </div>
    </div>
  )
}
