import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon } from '@/components/icon'
import { PostHogProvider } from '@/components/posthog-provider'
import { SiteNav } from '@/components/site-nav'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'World of Indiecraft — the founders’ armory',
    template: '%s — World of Indiecraft',
  },
  description:
    'Lifetime revenue is XP, MRR is item level, products are gear. A public armory for indie founders.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>
          <header className="topbar">
            <Link href="/" className="topbar-mark serif">
              {/* The crest slot the reference fills with a faction sigil. */}
              <Icon name="crest" size={22} className="topbar-crest" />
              <span className="topbar-over">World of</span> INDIECRAFT
            </Link>
            <SiteNav />
          </header>
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}
