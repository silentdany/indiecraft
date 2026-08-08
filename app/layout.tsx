import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { PostHogProvider } from '@/components/posthog-provider'
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
            <Link href="/" className="serif gold">
              <span className="topbar-over">World of</span> INDIECRAFT
            </Link>
            <nav>
              <Link href="/ladder" className="label">
                Ladder
              </Link>
              <a href="https://github.com/silentdany/indiecraft" className="label">
                Source
              </a>
            </nav>
          </header>
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}
