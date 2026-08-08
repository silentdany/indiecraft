'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * The one action on the landing page.
 *
 * "Inspect" is the right verb: in WoW you right-click a player and inspect
 * their gear. It says what happens without a sentence of explanation, which is
 * the whole reason this page has no paragraphs.
 */
export function InspectSearch() {
  const router = useRouter()
  const [handle, setHandle] = useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const clean = handle
      .trim()
      .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '')
      .replace(/^@/, '')
      .split(/[/?#]/)[0]
      ?.toLowerCase()
    if (clean) router.push(`/c/${encodeURIComponent(clean)}`)
  }

  return (
    <form onSubmit={submit} className="inspect">
      <span className="inspect-at" aria-hidden="true">
        @
      </span>
      <input
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        placeholder="your x handle"
        aria-label="X handle"
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
      />
      <button type="submit" className="serif">
        INSPECT
      </button>
    </form>
  )
}
