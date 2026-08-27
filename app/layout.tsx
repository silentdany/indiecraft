import type { Metadata } from 'next'
import { Alegreya_Sans } from 'next/font/google'
import Link from 'next/link'
import Script from 'next/script'
import type { ReactNode } from 'react'
import { BrandMark } from '@/components/brand-mark'
import { PostHogProvider } from '@/components/posthog-provider'
import { SiteFooter } from '@/components/site-footer'
import { SiteNav } from '@/components/site-nav'
import './globals.css'

/**
 * Body text, self-hosted.
 *
 * `next/font/google` downloads at build time and serves the files from our own
 * origin, so this keeps the rule Cinzel already follows: nothing fetches a font
 * at runtime. It also emits the @font-face and a `font-display: swap` for free.
 *
 * Anything over the system stack because the system stack is whatever the
 * reader happens to own — San Francisco on a Mac, Segoe on Windows, Roboto on
 * Android — and a readout this dense should not look like three different
 * products depending on who opened it.
 *
 * Alegreya Sans over the grotesques it was benched against because it is the
 * only one with calligraphic roots, and the page it sits on is set in Cinzel,
 * a Roman capital. The two share a skeleton; a neutral UI face next to Cinzel
 * reads as two unrelated pages pasted together.
 *
 * Two consequences it carries, both handled in globals.css: it has no 600, and
 * its figures are oldstyle by default — which on a site that is mostly dollar
 * amounts turns `$0 MRR` into `$o MRR`.
 */
const sans = Alegreya_Sans({
  subsets: ['latin'],
  // No 600 in the family. globals.css asks for 400/500/700 only, so nothing
  // here is left to the browser to synthesise.
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--ic-font-sans',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'World of Indiecraft — the founders’ armory',
    template: '%s — World of Indiecraft',
  },
  description:
    'Lifetime revenue is XP, every stat is an equipment slot, and item level is the average of your gear. A public armory for indie founders, built on TrustMRR data.',
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
    <html lang="en" className={sans.variable}>
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
        {/*
          DataFast, beside PostHog rather than instead of it: PostHog answers
          what somebody did on a sheet, this answers where they came from. The
          question the site keeps asking is how many views arrive from a
          referrer that is not us, and one of the two is built for it.

          `afterInteractive` is the component's default and the right one here —
          the script is not needed before hydration, and nothing on the page
          waits for it. In the layout rather than per page, because it has to
          count every route.

          The two data attributes are the account and the property; they are
          not secrets, and they are hardcoded rather than read from env for
          that reason — a missing variable would silently stop the counting.
        */}
        <Script
          src="https://datafa.st/js/script.js"
          data-website-id="dfid_vQWa4WNjZXWI5axQm3JIG"
          data-domain="indiecraft.quest"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
