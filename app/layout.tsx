import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { PostHogProvider } from '@/components/posthog-provider'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Indiecraft',
    template: '%s — Indiecraft',
  },
  description: 'Character sheets for indie founders.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>
          <header
            style={{
              borderBottom: '1px solid var(--ic-line-2)',
              padding: '14px 20px',
              display: 'flex',
              gap: 24,
              alignItems: 'baseline',
            }}
          >
            <Link href="/" className="serif gold" style={{ fontSize: 18 }}>
              INDIECRAFT
            </Link>
            <Link href="/ladder" className="label">
              Ladder
            </Link>
          </header>
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}
