import Link from 'next/link'
import { Frame } from '@/components/frame'
import { LEVEL_THRESHOLDS } from '@/engine'
import { getLadder } from '@/lib/queries'

export const revalidate = 300

export default async function Home() {
  const top = await getLadder().catch(() => [])

  return (
    <main className="page">
      <Frame>
        <h1 className="serif gold" style={{ fontSize: 32, margin: 0, letterSpacing: '0.08em' }}>
          INDIECRAFT
        </h1>
        <p style={{ maxWidth: 560 }}>
          A public armory for indie founders. Lifetime revenue is your XP, MRR is your item level,
          and your products are your gear. Nothing to install, no account.
        </p>
        <p className="muted" style={{ fontSize: 13 }}>
          Level table: {LEVEL_THRESHOLDS.length} tiers, from the first dollar to ten million. The
          formula is public — <a href="https://github.com">go read it</a>.
        </p>
        <Link href="/ladder" className="serif">
          See the ladder →
        </Link>
      </Frame>

      {top.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h2 className="serif" style={{ fontSize: 15, letterSpacing: '0.1em' }}>
            LEADING
          </h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {top.slice(0, 8).map((row) => (
              <Link
                key={row.handle}
                href={`/c/${row.handle}`}
                className="surface"
                style={{
                  padding: '8px 12px',
                  borderLeft: `2px solid ${row.rarity.hex}`,
                  color: row.rarity.hex,
                }}
              >
                <span className="serif">{row.level}</span> @{row.handle}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
