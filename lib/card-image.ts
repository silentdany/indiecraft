import { ogImageId } from './og-image'

/** 9:16, the story size. The timeline card stays 1200×630. */
export const STORY_SIZE = { width: 1080, height: 1920 } as const

/**
 * The poster for a founder.
 *
 * The id in the path is the same cache bust the timeline card uses: level and
 * item level are the two numbers that move, and a CDN that has seen the old
 * URL will not fetch the new picture. The path is excluded from content
 * negotiation in lib/negotiable.ts — an `<img>` sends `Accept: image/png`,
 * and a negotiable URL that produces neither HTML nor markdown is answered
 * 406.
 */
export function storyCardPath(handle: string, level: number, ilvl: number | null): string {
  return `/c/${handle}/poster/${ogImageId(level, ilvl)}`
}
