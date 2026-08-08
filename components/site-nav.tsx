'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * The armory tab strip.
 *
 * A tab strip that never shows which tab you are on is just a row of links, so
 * this is a client component for exactly one reason: `usePathname`.
 */
const TABS = [
  { href: '/', label: 'Armory' },
  { href: '/ladder', label: 'Ladder' },
]

export function SiteNav() {
  const pathname = usePathname()

  return (
    <nav className="tabs" aria-label="Sections">
      {TABS.map((tab) => {
        // A character sheet belongs under the armory, not to no tab at all.
        const selected = tab.href === '/' ? !pathname.startsWith('/ladder') : pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="tab"
            aria-current={selected ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        )
      })}
      <a className="tab" href="https://github.com/silentdany/indiecraft">
        Source
      </a>
    </nav>
  )
}
