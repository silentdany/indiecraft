import { Icon, type IconName } from '@/components/icon'
import { wowIconUrl } from '@/lib/wow-icon'

/**
 * A real Blizzard icon with a drawn glyph underneath it.
 *
 * Extracted from the paper doll, which invented this pattern and was for a
 * while the only place using it. Everything the reference gives a picture to
 * now goes through here: items, achievements, classes, factions.
 *
 * The fallback is the whole reason it is a component rather than an <img>. The
 * icons are hotlinked from a CDN that owes us nothing, so one day a square will
 * fail to load — and when it does, a drawn glyph in the right colour is already
 * sitting behind it. No `onError`, because a handler would make every caller a
 * client component for a case that has to work with JavaScript off anyway.
 *
 * The layering is CSS (`.wowicon`): both children occupy one grid cell, the
 * image on top. A broken <img> with an empty alt collapses to nothing and lets
 * the glyph through.
 */
export function WowIcon({
  slug,
  glyph,
  size,
  bare,
  color,
  className = '',
}: {
  /** Blizzard icon slug, e.g. `classicon_mage`. Null falls straight to the glyph. */
  slug: string | null
  /** What to draw when the picture does not arrive. */
  glyph: IconName
  /** Box size in px. The glyph is drawn at roughly half, as line art needs air. */
  size: number
  /**
   * Drop the bordered square.
   *
   * The square is the item frame, and it means something: a quality colour on
   * four sides is how the reference says "this is a piece of gear". A class
   * emblem is not gear — it is a sigil — and boxing it says the wrong thing
   * while also adding an outline to every ladder row and every class list.
   */
  bare?: boolean
  /**
   * Colour for the drawn fallback, and for the square's border when there is
   * one. Only ever the fallback's business: the JPEG on top carries its own
   * colours and ignores this entirely.
   */
  color?: string
  className?: string
}) {
  return (
    <span
      className={`${bare ? '' : 'qsquare'} wowicon ${className}`}
      style={{ width: size, height: size, color }}
    >
      <Icon name={glyph} size={Math.round(size * 0.52)} />
      {slug && (
        // biome-ignore lint/performance/noImgElement: a remote host next/image is not configured for, and the fallback depends on a plain <img> failing quietly.
        <img src={wowIconUrl(slug)} alt="" width={size} height={size} loading="lazy" />
      )}
    </span>
  )
}
