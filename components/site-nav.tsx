'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * The armory tab strip, plus the lookup.
 *
 * A tab strip that never shows which tab you are on is just a row of links, so
 * this is a client component for `usePathname`.
 *
 * The search rides along for a reason: the armory front has a large one, and
 * every other page had none, so looking up a second founder meant going home
 * first. It hides on the front page rather than competing with the big one
 * eight lines below it.
 */
const TABS = [
  { href: '/', label: 'Armory' },
  { href: '/ladder', label: 'Ladder' },
  { href: '/rules', label: 'Rules' },
]

export function SiteNav() {
  const pathname = usePathname()
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
    if (clean) {
      setHandle('')
      router.push(`/c/${encodeURIComponent(clean)}`)
    }
  }

  const isSection = (href: string) =>
    href === '/'
      ? pathname === '/' || pathname.startsWith('/c/')
      : pathname === href || pathname.startsWith(`${href}?`)

  return (
    <div className="topbar-right">
      {pathname !== '/' && (
        <search className="navsearch">
          <form onSubmit={submit}>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="inspect a handle"
              aria-label="Inspect an X handle"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </form>
        </search>
      )}

      <nav className="tabs" aria-label="Sections">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="tab"
            aria-current={isSection(tab.href) ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
