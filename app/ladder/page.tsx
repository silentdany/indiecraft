import type { Metadata } from 'next'
import Link from 'next/link'
import { Frame } from '@/components/frame'
import { LadderTable } from '@/components/ladder-table'
import { getClassCounts, getLadder } from '@/lib/queries'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Ladder',
  description: 'The top one hundred founders by level.',
}

export default async function Ladder({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>
}) {
  const { class: selected } = await searchParams
  const [rows, classes] = await Promise.all([getLadder(selected), getClassCounts()])

  return (
    <main className="page">
      <header className="section-head">
        <h1 className="serif gold" style={{ fontSize: 22, letterSpacing: '0.14em', margin: 0 }}>
          THE LADDER
        </h1>
        {/* No bottom rankings. We show a top, never the floor. */}
        <span className="label">Top 100 by level, then iLvl</span>
      </header>

      <nav className="classbar" aria-label="Filter by class">
        <Link href="/ladder" style={active(!selected)}>
          All
        </Link>
        {classes.map((c) => (
          <Link
            key={c.name}
            href={`/ladder?class=${encodeURIComponent(c.name)}`}
            style={active(selected === c.name)}
          >
            {c.name} <span className="muted">{c.count}</span>
          </Link>
        ))}
      </nav>

      <Frame style={{ padding: 10 }}>
        <LadderTable rows={rows} />
      </Frame>
    </main>
  )
}

function active(on: boolean) {
  return on ? { borderColor: 'var(--ic-gold)', color: 'var(--ic-gold-bright)' } : undefined
}
