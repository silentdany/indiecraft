'use client'

import { useEffect, useState } from 'react'
import { WowIcon } from '@/components/wow-icon'

/**
 * "DING!" — the level-up and achievement announcement.
 *
 * The one place on this site where JavaScript is the right answer, and the
 * reason is not the animation. It is that news has to be news: `recentLevelUp`
 * covers seven days, so a server-rendered banner would greet the same founder
 * with the same congratulation on every visit for a week, which is not a toast,
 * it is wallpaper with an exclamation mark. Firing once per viewer needs to
 * know what that viewer has already seen, and the smallest honest place to keep
 * that is their own browser.
 *
 * localStorage rather than a table: this is the first stateful thing the quest
 * work would own, and a per-viewer "I saw it" is not worth a column, a migration
 * and a signed-in account — especially on a site where one founder in 3,900 has
 * ever signed in. Clearing your storage replays a week-old congratulation. That
 * is the whole downside.
 *
 * Phrased in the third person on purpose. We cannot know who is reading — a
 * sheet is public and almost nobody signs in — and "Ddcaridi reached level 55"
 * is true for the founder and interesting to a stranger, where "You reached
 * level 55" is a lie to everyone but one person. It is also how the game says
 * it: achievement announcements are broadcast to the server, not whispered.
 *
 * Renders nothing on the server, by necessity: what to show depends on
 * localStorage, which does not exist there.
 */

export interface DingEvent {
  /** Stable per founder and event, so "seen" survives a recompute. */
  key: string
  kicker: string
  line: string
  /** The borrowed picture: the badge's own icon, or the level crest. */
  icon: string | null
  /** Quality colour for the frame, when the event has one. */
  hex?: string
  /**
   * The number in the right-hand crest.
   *
   * The reference puts achievement points there. We have no points, so a level
   * goes in it and a badge leaves it empty rather than inventing a score — an
   * ornament with a made-up number in it is worse than no ornament.
   */
  badge?: string
}

const SEEN_PREFIX = 'indiecraft:seen:'
/** Long enough to read twice, short enough not to sit on the page. */
const DISMISS_MS = 9000

export function DingToast({ handle, events }: { handle: string; events: DingEvent[] }) {
  const [live, setLive] = useState<DingEvent[]>([])
  /*
   * The effect keys off the event names, not the array.
   *
   * `events` is built fresh on every render of the page, so a new identity each
   * time — and depending on it meant any re-render tore down the dismiss timer
   * and set it up again, or cleared it and never replaced it, leaving the toast
   * on screen for good.
   */
  const signature = events.map((e) => e.key).join('|')

  // biome-ignore lint/correctness/useExhaustiveDependencies: `signature` stands in for `events`, deliberately — see above.
  useEffect(() => {
    if (events.length === 0) return
    let unseen: DingEvent[] = []
    try {
      unseen = events.filter((e) => !localStorage.getItem(`${SEEN_PREFIX}${handle}:${e.key}`))
      // Marked on show rather than on dismiss: a founder who navigates away
      // mid-toast has still been told, and replaying it on the next page would
      // be the bug this component exists to avoid.
      for (const e of unseen) localStorage.setItem(`${SEEN_PREFIX}${handle}:${e.key}`, '1')
    } catch {
      // Private mode, or storage disabled. Saying nothing beats saying it every
      // single time, which is what the alternative amounts to.
      return
    }
    if (unseen.length === 0) return
    setLive(unseen)
    const timer = setTimeout(() => setLive([]), DISMISS_MS)
    return () => clearTimeout(timer)
  }, [handle, signature])

  if (live.length === 0) return null

  return (
    <div className="dings" role="status" aria-live="polite">
      {live.map((e) => (
        <div className="ding" key={e.key} style={e.hex ? { borderColor: e.hex } : undefined}>
          {/*
            Laid out like the game's own announcement: framed icon on the left,
            a sunken plaque carrying a thin kicker over the name, and a crest on
            the right for the number. What is deliberately NOT copied is the
            ornamental leafwork around the reference's frame — that is Blizzard's
            artwork, where an item icon is a borrowed picture we already ask for
            by name.
          */}
          <WowIcon
            className="ding-icon"
            color={e.hex}
            glyph="achievement"
            size={48}
            slug={e.icon}
          />
          <span className="ding-plaque">
            <span className="ding-kicker">{e.kicker}</span>
            <span className="ding-line serif">{e.line}</span>
          </span>
          {e.badge && <span className="ding-crest serif">{e.badge}</span>}
          <button
            className="ding-close"
            onClick={() => setLive((rest) => rest.filter((x) => x.key !== e.key))}
            type="button"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
