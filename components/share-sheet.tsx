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
  const [copied, setCopied] = useState<'link' | 'badge' | null>(null)
  const [showBadge, setShowBadge] = useState(false)

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const url = `${origin}/c/${handle}?s=${level}-${ilvl ?? 'na'}`
  const text = `Level ${level} ${characterClass}, rank #${rank} on the World of Indiecraft armory.`
  const badge = `[![World of Indiecraft](${origin}/c/${handle}/badge.svg)](${origin}/c/${handle})`

  async function copy(what: 'link' | 'badge') {
    try {
      await navigator.clipboard.writeText(what === 'link' ? url : badge)
      setCopied(what)
      capture('share_clicked', { handle, target: what })
      setTimeout(() => setCopied(null), 2000)
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
      <button type="button" className="share-copy label" onClick={() => copy('link')}>
        <Icon name="gear" size={13} />
        {copied === 'link' ? 'Copied' : 'Copy link'}
      </button>
      {/*
        The badge is the loop that runs without anybody thinking about it: one
        line of Markdown in a README, and from then on it updates itself and
        links back. It is folded away behind a toggle because it is for the
        founder, once, and everybody else on this page came to read a sheet.
      */}
      <button type="button" className="share-copy label" onClick={() => setShowBadge((v) => !v)}>
        <Icon name="crest" size={13} />
        Badge
      </button>

      {showBadge && (
        <div className="share-badge">
          {/* biome-ignore lint/performance/noImgElement: the point is the raw endpoint, exactly as a README would embed it. */}
          <img src={`/c/${handle}/badge.svg`} alt={`Level ${level} ${characterClass} badge`} />
          <code>{badge}</code>
          <button type="button" className="share-copy label" onClick={() => copy('badge')}>
            {copied === 'badge' ? 'Copied' : 'Copy Markdown'}
          </button>
        </div>
      )}
    </div>
  )
}
