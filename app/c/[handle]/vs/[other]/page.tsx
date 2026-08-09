import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Versus } from '@/components/versus'
import { getCharacter } from '@/lib/queries'

export const revalidate = 300

type Props = { params: Promise<{ handle: string; other: string }> }

/**
 * Two characters, side by side.
 *
 * `noindex` on purpose, and not for the usual reason. Every founder pairs with
 * every other one, so this route is 142 × 141 pages generated from data most of
 * those people never consented to publish — the combinatorial version of the
 * exposure the plain ladder already carries once. The page works, it is linked
 * from both sheets, and anybody can share it. It is simply not submitted to be
 * crawled.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle, other } = await params
  const [a, b] = await Promise.all([getCharacter(handle), getCharacter(other)])
  if (!a || !b) return { title: 'Character not found', robots: { index: false, follow: false } }

  const title = `${a.displayName} vs ${b.displayName}`
  return {
    title,
    description: `Level ${a.level} ${a.characterClass} against level ${b.level} ${b.characterClass}, stat for stat.`,
    robots: { index: false, follow: true },
    alternates: { canonical: `/c/${a.handle}/vs/${b.handle}` },
    openGraph: { title, url: `/c/${a.handle}/vs/${b.handle}` },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function VersusPage({ params }: Props) {
  const { handle, other } = await params
  const [a, b] = await Promise.all([getCharacter(handle), getCharacter(other)])

  // Either side opted out or never existed: there is no comparison to render,
  // and an opted-out founder must not reappear through a second URL.
  if (!a || !b) notFound()

  // Comparing somebody with themselves produces a page of ties. Send them to
  // the sheet, which is what they actually wanted.
  if (a.handle === b.handle) notFound()

  return (
    <main className="page">
      <header className="page-head">
        <h1 className="serif gold">
          {a.displayName} <span className="muted">vs</span> {b.displayName}
        </h1>
        <p className="muted">
          Stat for stat. A row appears only where both sides have the number — a blank column is
          missing data, never a defeat.
        </p>
      </header>

      <Versus a={a} b={b} />

      <p className="rules-outro">
        <Link href={`/c/${a.handle}`}>Back to @{a.handle}</Link> ·{' '}
        <Link href="/ladder">The ladder</Link>
      </p>
    </main>
  )
}
