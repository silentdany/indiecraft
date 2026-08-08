import Link from 'next/link'
import { Frame } from '@/components/frame'
import { InspectSearch } from '@/components/inspect-search'
import { LadderTable } from '@/components/ladder-table'
import { getClassCounts, getLadder, getRealmStats } from '@/lib/queries'

export const revalidate = 300

/**
 * The armory front.
 *
 * Deliberately not a marketing page: no hero paragraph, no feature grid, no
 * testimonial. WoW's own front door is a character list and a search box, and
 * the product here IS the ladder — so the ladder is the page. Anyone who wants
 * the rules can read them in the repo, which is linked once and never
 * explained.
 */
export default async function Home() {
  const [rows, stats, classes] = await Promise.all([
    getLadder().catch(() => []),
    getRealmStats().catch(() => null),
    getClassCounts().catch(() => []),
  ])

  return (
    <main className="page">
      <Frame className="hero">
        <p className="wordmark-over label">World of</p>
        <h1 className="wordmark serif">INDIECRAFT</h1>
        <p className="wordmark-under label">The founders&rsquo; armory</p>

        <InspectSearch />

        <p className="hero-note muted">
          Lifetime revenue is XP. MRR is item level. Your products are your gear.
        </p>
      </Frame>

      {stats && stats.characters > 0 && (
        <section className="realm" aria-label="Realm status">
          <Stat label="Characters" value={stats.characters.toLocaleString('en-US')} />
          <Stat label="Highest level" value={String(stats.maxLevel)} />
          <Stat label="Tracked MRR" value={compactUsd(stats.trackedMrrUsd)} />
          <Stat label="Gear" value={stats.products.toLocaleString('en-US')} />
          <Stat label="Achievements" value={stats.achievements.toLocaleString('en-US')} />
        </section>
      )}

      <section style={{ marginTop: 26 }}>
        <header className="section-head">
          <h2 className="serif">THE LADDER</h2>
          <Link href="/ladder" className="label">
            Full top 100 →
          </Link>
        </header>

        {classes.length > 0 && (
          <nav className="tabs" aria-label="Filter by class">
            {classes.map((c) => (
              <Link
                key={c.name}
                href={`/ladder?class=${encodeURIComponent(c.name)}`}
                className="tab"
              >
                {c.name} <span className="tab-count">{c.count}</span>
              </Link>
            ))}
          </nav>
        )}

        <LadderTable rows={rows.slice(0, 20)} />
      </section>

      <footer className="footer">
        <span className="muted">
          Numbers from <a href="https://trustmrr.com">TrustMRR</a>. Nothing shown that they
          don&rsquo;t already show.
        </span>
        <a href="https://github.com/silentdany/indiecraft">Read the formula</a>
      </footer>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="realm-cell">
      <span className="serif">{value}</span>
      <span className="stat-name">{label}</span>
    </div>
  )
}

/** $2.1M reads at a glance; $2,134,908 does not. */
function compactUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}
