import type { Metadata } from 'next'
import Link from 'next/link'
import { Frame } from '@/components/frame'
import { getClasses, getLadder } from '@/lib/queries'

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
  const [rows, classes] = await Promise.all([getLadder(selected), getClasses()])

  return (
    <main className="page">
      <h1 className="serif gold" style={{ fontSize: 24, letterSpacing: '0.08em' }}>
        LADDER
      </h1>
      {/* No bottom rankings. We show a top, never the floor. */}
      <p className="muted" style={{ marginTop: 0 }}>
        The top one hundred by level, then by iLvl on a tie.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '18px 0' }}>
        <Link href="/ladder" className="label" style={filterStyle(!selected)}>
          All classes
        </Link>
        {classes.map((name) => (
          <Link
            key={name}
            href={`/ladder?class=${encodeURIComponent(name)}`}
            className="label"
            style={filterStyle(selected === name)}
          >
            {name}
          </Link>
        ))}
      </div>

      <Frame style={{ padding: 12 }}>
        {rows.length === 0 ? (
          <p className="muted" style={{ padding: 12 }}>
            No characters computed yet. Run the crawl, then the compute step.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {rows.map((row) => (
                <tr key={row.handle} style={{ borderBottom: '1px solid var(--ic-line)' }}>
                  <td className="serif muted" style={{ padding: '8px 10px', width: 56 }}>
                    {row.rank}
                  </td>
                  <td
                    className="serif"
                    style={{
                      padding: '8px 10px',
                      width: 64,
                      color: row.rarity.hex,
                      fontSize: 18,
                    }}
                  >
                    {row.level}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <Link href={`/c/${row.handle}`} style={{ color: row.rarity.hex }}>
                      @{row.handle}
                    </Link>
                  </td>
                  <td className="muted" style={{ padding: '8px 10px' }}>
                    {row.characterClass}
                  </td>
                  <td className="label" style={{ padding: '8px 10px', textAlign: 'right' }}>
                    iLvl {row.ilvl}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Frame>
    </main>
  )
}

function filterStyle(active: boolean) {
  return {
    border: `1px solid ${active ? 'var(--ic-gold)' : 'var(--ic-line-2)'}`,
    color: active ? 'var(--ic-gold-bright)' : 'var(--ic-text-muted)',
    padding: '5px 10px',
  }
}
