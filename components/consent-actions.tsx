'use client'

import { useState } from 'react'
import { WowIcon } from '@/components/wow-icon'
import { UI_ICONS } from '@/engine'
import { capture } from './posthog-provider'

/**
 * The three things a founder can do about their own sheet.
 *
 * The shape of this block is the consent model made visible:
 *
 *   not signed in  → one link: prove you are this person.
 *   signed in, someone else's sheet → nothing to offer, and it says so.
 *   signed in, yours, unclaimed → claim, or remove.
 *   signed in, yours, claimed → says so plainly, then unclaim or remove.
 *
 * Removal asks once before it happens. It used to fire on the first click,
 * which is defensible for a right somebody should never have to fight for —
 * until the first person to claim a sheet removed it by accident a minute
 * later. One click is a promise about how FEW steps leaving costs, not a
 * promise to act before the person has finished reading the button. The
 * confirm is inline, needs no dialog, and the second click is still the
 * second click.
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
  const [confirming, setConfirming] = useState(false)

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

  if (state === 'removed') {
    return (
      <p className="muted">
        Sheet removed. It is gone from the ladder. Signing in again on this URL will offer it back —
        nothing is deleted.
      </p>
    )
  }

  if (!viewer) {
    return (
      <div className="consent">
        <a
          href={`/api/auth/x/start?next=${encodeURIComponent(`/c/${handle}`)}`}
          onClick={() => capture('claim_started', { handle })}
          className="consent-claim serif"
        >
          <WowIcon slug={UI_ICONS.claim} glyph="crest" size={20} bare />
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
    <div className="consent-own">
      {/* Who you are and what this sheet is, before any button. Somebody who
          has just signed in should not have to infer either from the fact that
          a "Remove" button appeared. */}
      <p className="consent-status">
        <WowIcon slug={UI_ICONS.signedIn} glyph="crest" size={19} bare />
        <span>
          Signed in as <strong>@{viewer}</strong> — this is your sheet
          {claimed ? (
            <>
              , and it is <strong className="gold">claimed</strong>. It is public, indexed and
              linked from the ladder.
            </>
          ) : (
            <>
              . It is <strong>not claimed</strong> yet, so it stays unlisted and out of search.
            </>
          )}
        </span>
      </p>

      <div className="consent">
        {claimed ? (
          <button
            type="button"
            onClick={() => act('unclaim')}
            disabled={state === 'working'}
            className="consent-remove label"
          >
            Unclaim — make it unlisted again
          </button>
        ) : (
          <button
            type="button"
            onClick={() => act('claim')}
            disabled={state === 'working'}
            className="consent-claim serif"
          >
            <WowIcon slug={UI_ICONS.claim} glyph="crest" size={20} bare />
            This is me — claim this sheet
          </button>
        )}

        {confirming ? (
          <span className="consent-confirm">
            <span className="label">Remove this sheet from the armory?</span>
            <button
              type="button"
              onClick={() => act('opt_out')}
              disabled={state === 'working'}
              className="consent-danger label"
            >
              {state === 'working' ? 'Removing…' : 'Yes, remove it'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="consent-remove label"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="consent-remove label"
          >
            Remove my sheet
          </button>
        )}

        {state === 'error' && <span className="muted">Failed. Try again.</span>}
      </div>
    </div>
  )
}
