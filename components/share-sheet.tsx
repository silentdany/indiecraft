'use client'

import { useEffect, useMemo, useState } from 'react'
import { WowIcon } from '@/components/wow-icon'
import { UI_ICONS } from '@/engine'
import { storyCardPath } from '@/lib/card-image'
import { ogImageId, ogImagePath } from '@/lib/og-image'
import { type ShareFacts, sharePosts } from '@/lib/share-text'
import { capture } from './posthog-provider'

/**
 * The share block, which is the one thing the whole product is measured on:
 * whether people post their sheet unprompted.
 *
 * One panel, three outputs: the timeline post, the story poster, the README
 * badge. The previous version stacked them — a mock tweet, a poster beside
 * it, a badge in a separate section underneath — and every one of them came
 * with its own row of small grey links, so the tab read as three unrelated
 * widgets and the eye had nowhere to start.
 *
 * Now it is a picker, a stage and a set of controls. You choose where it is
 * going, you see exactly what will be posted there, and there is one gold
 * button that does it. Everything else is secondary and looks it.
 */

type Format = 'post' | 'story' | 'badge'

const FORMATS: { key: Format; name: string; where: string; ratio: string }[] = [
  { key: 'post', name: 'Post', where: 'X, LinkedIn', ratio: '1200 / 630' },
  { key: 'story', name: 'Story', where: 'Instagram, TikTok', ratio: '9 / 16' },
  { key: 'badge', name: 'Badge', where: 'README, site', ratio: '6 / 1' },
]

/** X counts a link as 23 characters, whatever its length. */
const X_LIMIT = 280 - 24

export function ShareSheet({
  handle,
  displayName,
  level,
  ilvl,
  characterClass,
  facts,
}: {
  handle: string
  displayName: string
  level: number
  ilvl: number | null
  characterClass: string
  facts: ShareFacts
}) {
  const [format, setFormat] = useState<Format>('post')
  const [copied, setCopied] = useState<string | null>(null)
  const [angle, setAngle] = useState(0)
  const posts = useMemo(() => sharePosts(facts), [facts])
  const [text, setText] = useState(posts[0]?.text ?? '')
  const [edited, setEdited] = useState(false)
  // Decided after mount: the server cannot know, and rendering the button on
  // one side only is a hydration mismatch.
  const [canShareFiles, setCanShareFiles] = useState(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    try {
      const probe = new File([''], 'probe.png', { type: 'image/png' })
      setCanShareFiles(Boolean(navigator.canShare?.({ files: [probe] })))
    } catch {
      setCanShareFiles(false)
    }
  }, [])

  /*
   * The `?s=` stamp is not redundant with the OG image's own versioned path.
   * That one stops X serving a stale IMAGE; this one stops X serving a stale
   * CARD, which it caches against the shared page URL and will not re-scrape.
   *
   * The configured site URL, not `window.location.origin`: reading the origin
   * off the browser made the server and client render different strings, a
   * hydration mismatch on every sheet.
   */
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const url = `${origin}/c/${handle}?s=${ogImageId(level, ilvl)}`
  const card = ogImagePath(handle, level, ilvl)
  const poster = storyCardPath(handle, level, ilvl)
  const badge = `/c/${handle}/badge.svg`
  const badgeMarkdown = `[![World of Indiecraft](${origin}${badge})](${origin}/c/${handle})`

  async function copy(what: string, value: string, event: string, target: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(what)
      capture(event, { handle, target })
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 2000)
    } catch {
      // Clipboard is refused on insecure origins and in some embedded views.
      // The value is on screen either way, so this is not worth an alert.
    }
  }

  function reword() {
    const next = (angle + 1) % posts.length
    setAngle(next)
    setText(posts[next]?.text ?? '')
    setEdited(false)
    capture('share_angle_changed', { handle })
  }

  /*
   * The poster is a story, and a story is posted from a phone. The share
   * sheet hands the PNG straight to Instagram or X on the device instead of
   * making somebody save it, leave, find it in their camera roll and come
   * back. Desktop browsers that cannot share a file never see the button.
   */
  async function sharePoster() {
    if (sharing) return
    setSharing(true)
    try {
      const response = await fetch(poster)
      const file = new File([await response.blob()], `indiecraft-${handle}.png`, {
        type: 'image/png',
      })
      await navigator.share({ files: [file], url })
      capture('share_clicked', { handle, target: 'poster_native' })
    } catch {
      // A dismissed share sheet rejects too, and that is not an error.
    } finally {
      setSharing(false)
    }
  }

  const remaining = X_LIMIT - text.length

  return (
    <section className="studio frame" aria-label="Share this sheet">
      <span className="corner corner-tl" />
      <span className="corner corner-tr" />
      <span className="corner corner-bl" />
      <span className="corner corner-br" />

      <div className="studio-formats" role="tablist" aria-label="Where it is going">
        {FORMATS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={format === f.key}
            className="studio-format"
            onClick={() => {
              setFormat(f.key)
              capture('share_format_changed', { handle, format: f.key })
            }}
          >
            {/* The shape of the output, drawn. Faster to read than any
                dimensions written out. */}
            <span className="studio-format-shape" style={{ aspectRatio: f.ratio }} />
            <span className="studio-format-words">
              <span className="studio-format-name serif">{f.name}</span>
              <span className="studio-format-where">{f.where}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="studio-body" data-format={format}>
        <div className="studio-stage">
          {format === 'post' && (
            <a
              className="studio-preview studio-preview-card"
              href={card}
              target="_blank"
              rel="noreferrer"
            >
              {/* biome-ignore lint/performance/noImgElement: the exact bytes X will attach. */}
              <img
                src={card}
                alt={`Level ${level} ${characterClass} card`}
                width={1200}
                height={630}
              />
            </a>
          )}
          {format === 'story' && (
            <a
              className="studio-preview studio-preview-poster"
              href={poster}
              target="_blank"
              rel="noreferrer"
              onClick={() => capture('share_clicked', { handle, target: 'poster_open' })}
            >
              {/* biome-ignore lint/performance/noImgElement: the exact bytes the download saves. */}
              <img
                src={poster}
                alt={`${displayName}, level ${level} ${characterClass} poster`}
                width={1080}
                height={1920}
              />
            </a>
          )}
          {format === 'badge' && (
            <div className="studio-preview studio-preview-badge">
              {/* biome-ignore lint/performance/noImgElement: an SVG shown at the size it will be embedded. */}
              <img src={badge} alt={`Level ${level} ${characterClass} badge`} />
            </div>
          )}
        </div>

        <div className="studio-controls">
          {format === 'post' && (
            <>
              <label className="studio-label" htmlFor="studio-text">
                Your post
              </label>
              {/* Editable. It was a paragraph you could only cycle, and the
                  one thing a founder most wants to do with a draft is put it
                  in their own words. */}
              <textarea
                id="studio-text"
                className="studio-text"
                value={text}
                rows={4}
                onChange={(e) => {
                  setText(e.target.value)
                  setEdited(true)
                }}
              />
              <div className="studio-text-foot">
                {posts.length > 1 ? (
                  <button type="button" className="studio-link" onClick={reword}>
                    <WowIcon slug={UI_ICONS.reword} glyph="shuffle" size={16} bare />
                    Another wording
                    <span className="studio-count">
                      {angle + 1}/{posts.length}
                    </span>
                  </button>
                ) : (
                  <span />
                )}
                <span className={remaining < 0 ? 'studio-chars is-over' : 'studio-chars'}>
                  {remaining}
                </span>
              </div>
              <p className="studio-note">
                The card is attached from the link — {origin.replace(/^https?:\/\//, '')}/c/
                {handle}
              </p>

              <a
                className="studio-primary"
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
                target="_blank"
                rel="noreferrer"
                onClick={() =>
                  capture('share_clicked', {
                    handle,
                    target: 'x',
                    angle: posts[angle]?.key,
                    edited,
                  })
                }
              >
                Post on X
              </a>
              <div className="studio-secondary">
                <button
                  type="button"
                  className="studio-link"
                  onClick={() => copy('link', url, 'share_clicked', 'copy')}
                >
                  <WowIcon slug={UI_ICONS.copyLink} glyph="link" size={16} bare />
                  {copied === 'link' ? 'Copied' : 'Copy link'}
                </button>
                <a className="studio-link" href={card} download={`indiecraft-${handle}.png`}>
                  <WowIcon slug={UI_ICONS.saveCard} glyph="download" size={16} bare />
                  Save image
                </a>
              </div>
            </>
          )}

          {format === 'story' && (
            <>
              <span className="studio-label">How to post it</span>
              <ol className="studio-steps">
                <li className="studio-step">
                  {canShareFiles ? 'Share the poster to your story.' : 'Save the poster.'}
                </li>
                <li className="studio-step">Add a link sticker with your sheet’s address.</li>
                <li className="studio-step">
                  Post it. Whoever taps the sticker lands on your sheet.
                </li>
              </ol>

              {canShareFiles ? (
                <button
                  type="button"
                  className="studio-primary"
                  onClick={sharePoster}
                  aria-busy={sharing}
                >
                  {sharing ? 'Opening…' : 'Share poster'}
                </button>
              ) : (
                <a
                  className="studio-primary"
                  href={poster}
                  download={`indiecraft-${handle}-poster.png`}
                  onClick={() => capture('share_clicked', { handle, target: 'poster_save' })}
                >
                  Save poster
                </a>
              )}
              <div className="studio-secondary">
                <button
                  type="button"
                  className="studio-link"
                  onClick={() => copy('sticker', url, 'share_clicked', 'poster_link')}
                >
                  <WowIcon slug={UI_ICONS.copyLink} glyph="link" size={16} bare />
                  {copied === 'sticker' ? 'Copied' : 'Copy link for the sticker'}
                </button>
                {canShareFiles && (
                  <a
                    className="studio-link"
                    href={poster}
                    download={`indiecraft-${handle}-poster.png`}
                    onClick={() => capture('share_clicked', { handle, target: 'poster_save' })}
                  >
                    <WowIcon slug={UI_ICONS.saveCard} glyph="download" size={16} bare />
                    Save
                  </a>
                )}
              </div>
            </>
          )}

          {format === 'badge' && (
            <>
              <span className="studio-label">Markdown</span>
              {/* Shown now, where before it was hidden: with the badge on its
                  own stage there is room for the snippet, and seeing it is
                  how somebody knows the button copies a link and not a
                  picture. */}
              <code className="studio-code">{badgeMarkdown}</code>
              <p className="studio-note">
                Updates itself every night and links back to this sheet.
              </p>

              <button
                type="button"
                className="studio-primary"
                onClick={() => copy('md', badgeMarkdown, 'badge_copied', 'md')}
              >
                {copied === 'md' ? 'Copied' : 'Copy Markdown'}
              </button>
              <div className="studio-secondary">
                <button
                  type="button"
                  className="studio-link"
                  onClick={() => copy('url', `${origin}${badge}`, 'badge_copied', 'url')}
                >
                  <WowIcon slug={UI_ICONS.copyLink} glyph="link" size={16} bare />
                  {copied === 'url' ? 'Copied' : 'Copy image URL'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
