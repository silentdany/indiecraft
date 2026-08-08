import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { BrandMark } from '@/components/brand-mark'
import { PostHogProvider } from '@/components/posthog-provider'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'World of Indiecraft — the founders’ armory',
    template: '%s — World of Indiecraft',
  },
  description:
    'Lifetime revenue is XP, MRR is item level, products are gear. A public armory for indie founders, built on TrustMRR data.',
  applicationName: 'World of Indiecraft',
  // Defaults every page inherits; each one overrides the title and description
  // and lets its own opengraph-image.tsx supply the picture.
  openGraph: {
    type: 'website',
    siteName: 'World of Indiecraft',
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>
          <header className="topbar">
            {/* Mark, then two stacked lines. "World of" set inline on the same
                baseline made one long string across a third of the bar and read
                as three loose objects rather than one lockup. */}
            <Link href="/" className="topbar-mark">
              <BrandMark size={30} className="topbar-crest" title="World of Indiecraft" />
              <span className="topbar-words">
                <span className="topbar-over">World of</span>
                <span className="topbar-name serif">INDIECRAFT</span>
              </span>
            </Link>
            <SiteNav />
          </header>
          {children}
          <SiteFooter />
        </PostHogProvider>
      </body>
    </html>
  )
}
