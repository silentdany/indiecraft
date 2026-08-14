/**
 * Item icons.
 *
 * ---------------------------------------------------------------------------
 * This is the one place the project serves an asset it did not draw, and the
 * exception is deliberate rather than an oversight. `components/icon.tsx` still
 * opens with "no Blizzard assets — not a font, not an icon, not a pixel", and
 * that rule still holds for every glyph in the interface: classes, stats,
 * achievements, factions are all drawn here.
 *
 * Equipment is carved out of it. Eighty-five items derived from eighty-five
 * Classic ones only read as the joke they are if the picture is the picture
 * people already know; a drawn stand-in makes the grid look like a different
 * game that is gesturing at this one. The drawn set survives as the fallback —
 * see ItemDef.icon and EquipmentGlyph.
 *
 * What this costs, stated plainly so nobody has to rediscover it:
 *   - the images are Blizzard's, served from Blizzard's CDN. Fansite use is
 *     tolerated; a commercial indiecraft is a conversation with a lawyer.
 *   - it is a hotlink. If the CDN moves or starts refusing us, seventeen
 *     squares per sheet go blank, which is why every consumer renders the
 *     drawn glyph underneath rather than an empty box.
 * ---------------------------------------------------------------------------
 */

/**
 * Blizzard's own render host, not Wowhead's zamimg mirror.
 *
 * Same pictures either way. This one is the URL the Game Data API hands back
 * from /data/wow/media/item/{id}, which makes it the canonical address rather
 * than someone else's copy — and it does not spend a third party's bandwidth
 * on our traffic.
 */
const HOST = 'https://render.worldofwarcraft.com'

/**
 * 56px is the only size the host publishes, and it is the size the game itself
 * uses in a bag. Squares larger than this upscale; that is the reference's own
 * look and not a defect to fix.
 */
export function wowIconUrl(slug: string, region = 'us'): string {
  return `${HOST}/${region}/icons/56/${slug}.jpg`
}

/**
 * An unknown slug answers 403 here rather than 404 — the host refuses rather
 * than admitting the file is absent. `pnpm verify-icons` treats anything that
 * is not a 200 as broken for exactly that reason: there is no status code that
 * means "this slug is fine but the file moved", so the only safe test is that
 * the bytes actually arrive.
 */
export const ICON_OK_STATUS = 200
