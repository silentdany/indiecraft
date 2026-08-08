'use client'

import { useState } from 'react'
import { capture } from './posthog-provider'

/**
 * One-click opt-out, visible on the sheet, no account, no email, immediate.
 *
 * This is the counterpart to crawling the numbers of people who never asked for
 * any of it. This button must never move to the footer, never gain an email
 * confirmation step, never become a form.
 */
export function OptOutButton({ handle, claimed }: { handle: string; claimed: boolean }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle')

  async function optOut() {
    setState('working')
    const res = await fetch('/api/opt-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle }),
    })
    if (res.ok) {
      setState('done')
      location.reload()
    } else {
      setState('error')
    }
  }

  if (state === 'done') return <p className="muted">Sheet removed.</p>

  return (
    <div className="consent">
      {/*
        Claiming is the whole growth loop and removal is the escape hatch, so
        the primary button belongs to the former. It used to be the other way
        round: the destructive action wore the border and the one we want people
        to take was quiet text, which made the wrong thing look more clickable.
        Removal stays one click, on the sheet, no account — that rule is about
        how few steps it takes, not how loud it looks.
      */}
      {!claimed && (
        <a
          href={`https://x.com/${handle}`}
          onClick={() => capture('claim_started', { handle })}
          className="consent-claim serif"
        >
          This is me — claim this sheet
        </a>
      )}
      <button
        type="button"
        onClick={optOut}
        disabled={state === 'working'}
        className="consent-remove label"
      >
        {state === 'working' ? 'Removing…' : 'Remove my sheet'}
      </button>
      {state === 'error' && <span className="muted">Failed. Try again.</span>}
    </div>
  )
}
