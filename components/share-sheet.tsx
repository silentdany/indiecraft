'use client'

import { useState } from 'react'
import { Icon } from '@/components/icon'
import { capture } from './posthog-provider'

/**
 * The share affordance.
 *
 * The project's stop criterion is whether people post their sheet unprompted,
 * and PostHog is wired to count views arriving from a referrer that is not us.
 * Until now the sheet offered no way to do the thing the whole product is
 * measured on — every share had to be a manual copy out of the address bar.
 *
 * The link carries a `?s=` stamp of the numbers that change. X caches OG images
 * hard and keys that cache on the URL, so a founder who levels up and reshares
 * would otherwise get last month's card.
 */
export function ShareSheet({
  handle,
  level,
  ilvl,
  characterClass,
  rank,
}: {
  handle: string
  level: number
  ilvl: number | null
  characterClass: string
  rank: number
}) {
  const [copied, setCopied] = useState(false)

  const url = `${typeof window === 'undefined' ? '' : window.location.origin}/c/${handle}?s=${level}-${ilvl ?? 'na'}`
  const text = `Level ${level} ${characterClass}, rank #${rank} on the World of Indiecraft armory.`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      capture('share_clicked', { handle, target: 'copy' })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard is refused on insecure origins and in some embedded views.
      // Selecting the address bar still works, so this is not worth an alert.
    }
  }

  return (
    <div className="share">
      <a
        className="share-x"
        href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noreferrer"
        onClick={() => capture('share_clicked', { handle, target: 'x' })}
      >
        Share on X
      </a>
      <button type="button" className="share-copy label" onClick={copy}>
        <Icon name="gear" size={13} />
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  )
}
