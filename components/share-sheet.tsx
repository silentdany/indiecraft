'use client'

import { useMemo, useState } from 'react'
import { WowIcon } from '@/components/wow-icon'
import { UI_ICONS } from '@/engine'
import { ogImageId, ogImagePath } from '@/lib/og-image'
import { type ShareFacts, sharePosts } from '@/lib/share-text'
import { capture } from './posthog-provider'

/**
 * The share block, which is the one thing the whole product is measured on:
 * whether people post their sheet unprompted.
 *
 * It is drawn as the post it will become — avatar, name, handle, the words, the
 * card underneath — because the previous version was a miniature of the page
 * next to a floating sentence and nothing said what either was for. The
 * thumbnail read as a redundant copy of the sheet directly above it, and "Top
 * 10% of 140 indie founders, apparently." read as a stray statistic rather than
 * as draft text somebody was about to publish under their own name.
 *
 * Nothing here needed explaining once it was shaped like the thing it produces.
 * Anybody who has used X knows what this is at a glance, which is worth more
 * than any caption we could have written above it.
 */
export function ShareSheet({
  handle,
  displayName,
  avatarUrl,
  level,
  ilvl,
  characterClass,
  facts,
}: {
  handle: string
  displayName: string
  avatarUrl: string | null
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
  /*
   * The configured site URL, not `window.location.origin`.
   *
   * Reading the origin off the browser meant the server rendered "/c/handle"
   * and the client rendered "indiecraft.quest/c/handle", which is a hydration
   * mismatch on every character sheet — React threw, discarded the subtree and
   * rebuilt it, and the share URL visibly changed after load. It was in the dev
   * log on every visit.
   *
   * `NEXT_PUBLIC_SITE_URL` is inlined at build time, so both renders agree, and
   * it is what robots.txt, the sitemap and the metadata base already use.
   */
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const url = `${origin}/c/${handle}?s=${ogImageId(level, ilvl)}`
  const card = ogImagePath(handle, level, ilvl)
  // Shown the way X shows it in a post: the host and path, no scheme.
  const displayUrl = `${origin.replace(/^https?:\/\//, '')}/c/${handle}`

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
    <section className="share" aria-label="Share this sheet">
      {/*
        The heading used to read SHARE, under a tab that already reads Share.
        A panel whose first line repeats the control that opened it is a line
        spent saying nothing. What a founder actually needs to know here is that
        the draft below is editable before it goes out — which is the one thing
        the old caption, "This is what gets posted", got slightly wrong.
      */}
      <p className="share-intro">
        A draft, not a button. Cycle the wording, then post it or take the card.
      </p>

      <div className="share-post">
        <div className="share-author">
          <span className="share-avatar">
            {avatarUrl ? (
              // biome-ignore lint/performance/noImgElement: matches the sheet portrait, which shares no pipeline with next/image.
              <img src={avatarUrl} alt="" width={40} height={40} />
            ) : (
              <span className="serif">{handle.slice(0, 1).toUpperCase()}</span>
            )}
          </span>
          <span className="share-author-name">{displayName}</span>
          <span className="share-author-handle muted">@{handle}</span>
        </div>

        <p className="share-text">{post?.text}</p>

        <a className="share-card" href={card} target="_blank" rel="noreferrer">
          {/* The same endpoint X fetches, at the shape X renders it. Lazy: it is
              a 1200×630 PNG rendered on demand, and the sheet above it is what
              people came for. */}
          {/* biome-ignore lint/performance/noImgElement: the exact bytes X will attach. */}
          <img
            src={card}
            alt={`Level ${level} ${characterClass} card`}
            loading="lazy"
            width={1200}
            height={630}
          />
          <span className="share-card-url">{displayUrl}</span>
        </a>
      </div>

      <div className="share-actions">
        <a
          className="share-x"
          href={`https://x.com/intent/tweet?text=${encodeURIComponent(post?.text ?? '')}&url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noreferrer"
          onClick={() => capture('share_clicked', { handle, target: 'x', angle: post?.key })}
        >
          Post on X
        </a>

        {/* Only when there is somewhere to cycle to: a founder with a single
            candidate would otherwise get a button that visibly does nothing.

            The counter is the fix for a button that changed a paragraph you
            were not looking at: without it, clicking twice on a founder with
            two angles landed back on the original text and read as broken. */}
        {posts.length > 1 && (
          <button
            type="button"
            className="share-copy label"
            onClick={() => {
              setAngle((a) => a + 1)
              capture('share_angle_changed', { handle })
            }}
          >
            <WowIcon slug={UI_ICONS.reword} glyph="shuffle" size={16} bare />
            Reword
            <span className="share-count">
              {(angle % posts.length) + 1}/{posts.length}
            </span>
          </button>
        )}

        <button type="button" className="share-copy label" onClick={copy}>
          <WowIcon slug={UI_ICONS.copyLink} glyph="link" size={16} bare />
          {copied ? 'Copied' : 'Copy link'}
        </button>

        {/*
          The card is a 1200×630 PNG at a stable URL, and until now the only way
          to get it was to right-click an <img> — so anybody posting anywhere
          other than X, or writing their own words, had no route to the picture
          at all. `download` on a same-origin href is the whole feature.
        */}
        <a className="share-copy label" href={card} download={`indiecraft-${handle}.png`}>
          <WowIcon slug={UI_ICONS.saveCard} glyph="download" size={16} bare />
          Save card
        </a>
      </div>
    </section>
  )
}
