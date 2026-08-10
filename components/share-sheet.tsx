'use client'

import { useMemo, useState } from 'react'
import { Icon } from '@/components/icon'
import { ogImageId, ogImagePath } from '@/lib/og-image'
import { type ShareFacts, sharePosts } from '@/lib/share-text'
import { capture } from './posthog-provider'

/**
 * The share affordance, which is the one thing the whole product is measured
 * on: whether people post their sheet unprompted.
 *
 * It used to be a button and a fixed sentence. Two things were wrong with that.
 *
 * The sentence was a system notification — "Level 56 Paladin, rank #13 on the
 * World of Indiecraft armory" — identical for all 142 founders, and nobody
 * posts a system notification on purpose. lib/share-text.ts now writes it from
 * what is actually true about this person, and offers several angles because
 * the one that appeals is not something this code can know.
 *
 * And it asked for a leap of faith. The card is the reason anybody shares this
 * at all, and it was invisible until after posting. It is now shown, at the
 * shape X renders it, next to the words that will go with it.
 */
export function ShareSheet({
  handle,
  level,
  ilvl,
  characterClass,
  facts,
}: {
  handle: string
  level: number
  ilvl: number | null
  characterClass: string
  facts: ShareFacts
}) {
  const [copied, setCopied] = useState(false)
  const [angle, setAngle] = useState(0)

  const posts = useMemo(() => sharePosts(facts), [facts])
  const post = posts[angle % posts.length] ?? posts[0]

  /*
   * The `?s=` stamp is not redundant with the OG image's own versioned path.
   * That one stops X serving a stale IMAGE; this one stops X serving a stale
   * CARD, which it caches against the shared page URL and will not re-scrape.
   * A founder who levels up and reshares the bare URL gets last month's card
   * back, image id or no image id.
   */
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const url = `${origin}/c/${handle}?s=${ogImageId(level, ilvl)}`
  const card = ogImagePath(handle, level, ilvl)

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
      {/* The card, at the shape X gives it. Lazy because it is a 1200×630 PNG
          rendered on demand and the sheet above it is the reason people came. */}
      <a
        className="share-preview"
        href={card}
        target="_blank"
        rel="noreferrer"
        title="Open the full card"
      >
        {/* biome-ignore lint/performance/noImgElement: the same endpoint X fetches, shown exactly as X will render it. */}
        <img
          src={card}
          alt={`Level ${level} ${characterClass} card`}
          loading="lazy"
          width={1200}
          height={630}
        />
      </a>

      <div className="share-compose">
        <p className="share-text">{post?.text}</p>

        <div className="share-actions">
          <a
            className="share-x"
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(post?.text ?? '')}&url=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => capture('share_clicked', { handle, target: 'x', angle: post?.key })}
          >
            Share on X
          </a>

          {/* Only when there is somewhere to cycle to. A founder with one
              candidate gets a button that visibly does nothing otherwise. */}
          {posts.length > 1 && (
            <button
              type="button"
              className="share-copy label"
              onClick={() => {
                setAngle((a) => a + 1)
                capture('share_angle_changed', { handle })
              }}
            >
              <Icon name="rising" size={13} />
              Another angle
            </button>
          )}

          <button type="button" className="share-copy label" onClick={copy}>
            <Icon name="gear" size={13} />
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>
    </div>
  )
}
