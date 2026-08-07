'use client'

import { useEffect } from 'react'
import { capture } from './posthog-provider'

/**
 * `character_viewed` (handle, referrer, claimed).
 *
 * The referrer is the only field that matters: the dashboard has to be able to
 * say how many views come from a referrer that isn't us.
 */
export function ViewTracker({ handle, claimed }: { handle: string; claimed: boolean }) {
  useEffect(() => {
    capture('character_viewed', {
      handle,
      claimed,
      referrer: document.referrer || null,
    })
  }, [handle, claimed])

  return null
}
