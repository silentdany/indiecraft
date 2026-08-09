'use client'

import { useState } from 'react'
import { Icon } from '@/components/icon'
import { capture } from './posthog-provider'

/**
 * The three things a founder can do about their own sheet.
 *
 * The shape of this block is the consent model made visible:
 *
 *   not signed in  → one link: prove you are this person.
 *   signed in, someone else's sheet → nothing to offer, and it says so.
 *   signed in, yours, unclaimed → claim, or remove.
 *   signed in, yours, claimed → unclaim, or remove.
 *
 * Claiming is the growth loop, so it gets the solid amber block. Removal stays
 * one click and never becomes a form — the spec's rule is about how few steps
 * leaving costs, and it survives sign-in intact because the person is already
 * signed in by the time they see the button.
 */
export function ConsentActions({
  handle,
  claimed,
  viewer,
  enabled,
}: {
  handle: string
  claimed: boolean
  /** The verified handle of whoever is looking, from the session cookie. */
  viewer: string | null
  enabled: boolean
}) {
  const [state, setState] = useState<'idle' | 'working' | 'removed' | 'error'>('idle')

  if (!enabled) return null

  const mine = viewer === handle

  async function act(action: 'claim' | 'unclaim' | 'opt_out') {
    setState('working')
    capture(`consent_${action}`, { handle })
    const response = await fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (!response.ok) return setState('error')
    if (action === 'opt_out') return setState('removed')
    location.reload()
  }

  if (state === 'removed')
    return <p className="muted">Sheet removed. It is gone from the ladder.</p>

  if (!viewer) {
    return (
      <div className="consent">
        <a
          href={`/api/auth/x/start?next=${encodeURIComponent(`/c/${handle}`)}`}
          onClick={() => capture('claim_started', { handle })}
          className="consent-claim serif"
        >
          <Icon name="crest" size={16} />
          {claimed ? 'Sign in with X' : 'This is me — claim this sheet'}
        </a>
        <span className="muted consent-note">
          Signing in with X is how we check you are @{handle}. We read your username and nothing
          else.
        </span>
      </div>
    )
  }

  if (!mine) {
    return (
      <p className="muted consent-note">
        Signed in as @{viewer}. You can claim or remove your own sheet — this one belongs to @
        {handle}.{' '}
        <a href={`/c/${viewer}`} className="gold">
          Go to yours
        </a>
        .
      </p>
    )
  }

  return (
    <div className="consent">
      {claimed ? (
        <button
          type="button"
          onClick={() => act('unclaim')}
          disabled={state === 'working'}
          className="consent-remove label"
        >
          Unclaim — make this sheet unlisted again
        </button>
      ) : (
        <button
          type="button"
          onClick={() => act('claim')}
          disabled={state === 'working'}
          className="consent-claim serif"
        >
          <Icon name="crest" size={16} />
          This is me — claim this sheet
        </button>
      )}
      <button
        type="button"
        onClick={() => act('opt_out')}
        disabled={state === 'working'}
        className="consent-remove label"
      >
        {state === 'working' ? 'Working…' : 'Remove my sheet'}
      </button>
      {state === 'error' && <span className="muted">Failed. Try again.</span>}
    </div>
  )
}
