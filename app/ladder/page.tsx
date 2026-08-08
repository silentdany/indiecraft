import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLd } from '@/components/json-ld'
import { LadderTable } from '@/components/ladder-table'
import { getClassCounts, getLadder } from '@/lib/queries'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'The ladder',
  description:
    'The hundred highest-levelled indie founders, ranked by lifetime revenue and current MRR. Filter by class.',
  alternates: { canonical: '/ladder' },
}

export default async function Ladder({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>
}) {
  const { class: selected } = await searchParams
  const [rows, classes] = await Promise.all([getLadder(selected), getClassCounts()])

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  return (
    <main className="page">
      {/* Ten entries, not a hundred: enough for a search engine to understand
          that this is a ranking, without shipping a kilobyte of JSON nobody
          reads. */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'The Indiecraft ladder',
          description: 'The highest-levelled indie founders, ranked by lifetime revenue.',
          numberOfItems: rows.length,
          itemListElement: rows.slice(0, 10).map((row) => ({
            '@type': 'ListItem',
            position: row.rank,
            name: `@${row.handle}`,
            url: `${site}/c/${row.handle}`,
          })),
        }}
      />

      <header className="section-head">
        <h1 className="serif gold" style={{ fontSize: 22, letterSpacing: '0.14em', margin: 0 }}>
          THE LADDER
        </h1>
        {/* No bottom rankings. We show a top, never the floor. */}
        <span className="label">Top 100 by level, then iLvl</span>
      </header>

      <nav className="tabs" aria-label="Filter by class">
        <Link href="/ladder" className="tab" aria-current={selected ? undefined : 'page'}>
          All
        </Link>
        {classes.map((c) => (
          <Link
            key={c.name}
            href={`/ladder?class=${encodeURIComponent(c.name)}`}
            className="tab"
            aria-current={selected === c.name ? 'page' : undefined}
          >
            {c.name} <span className="tab-count">{c.count}</span>
          </Link>
        ))}
      </nav>

      <LadderTable rows={rows} />
    </main>
  )
}
