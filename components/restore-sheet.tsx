'use client'

import { useState } from 'react'
import { WowIcon } from '@/components/wow-icon'
import { UI_ICONS } from '@/engine'
import { capture } from './posthog-provider'

/**
 * The way back from a removal.
 *
 * Removing a sheet makes it 404, including for the person who removed it, so
 * an accidental click used to be permanent — there was no page left to change
 * your mind on. This is that page, and only the account that owns the handle
 * ever sees it.
 *
 * Nothing about the founder is shown here. Somebody who removed their sheet
 * has asked not to be displayed, and "here is everything we still hold about
 * you" would be the opposite of honouring it.
 */
export function RestoreSheet({ handle, viewer }: { handle: string; viewer: string | null }) {
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle')

  if (viewer !== handle) return null

  async function restore() {
    setState('working')
    capture('consent_restore', { handle })
    // 'claim' is the restore: it clears opted_out_at and marks the sheet
    // claimed in one gesture, which is what somebody undoing a removal wants.
    const response = await fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'claim' }),
    })
    if (!response.ok) return setState('error')
    location.href = `/c/${handle}`
  }

  return (
    <div className="restore">
      <p className="consent-status">
        <WowIcon slug={UI_ICONS.signedIn} glyph="crest" size={19} bare />
        <span>
          Signed in as <strong>@{viewer}</strong>. You removed this sheet, so nobody else can see
          it.
        </span>
      </p>
      <p className="muted">
        Nothing was deleted — it is only hidden. Putting it back restores it exactly as it was, and
        you can remove it again at any time.
      </p>
      <div className="consent">
        <button
          type="button"
          onClick={restore}
          disabled={state === 'working'}
          className="consent-claim serif"
        >
          <WowIcon slug={UI_ICONS.restore} glyph="crest" size={20} bare />
          {state === 'working' ? 'Restoring…' : 'Put my sheet back'}
        </button>
        {state === 'error' && <span className="muted">Failed. Try again.</span>}
      </div>
    </div>
  )
}
