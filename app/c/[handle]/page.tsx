import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Frame } from '@/components/frame'
import { OptOutButton } from '@/components/opt-out-button'
import { ViewTracker } from '@/components/view-tracker'
import { ACHIEVEMENTS_BY_CODE } from '@/engine'
import { getCharacter } from '@/lib/queries'

export const revalidate = 300

type Props = { params: Promise<{ handle: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params
  const character = await getCharacter(handle)
  if (!character) return { title: 'Character not found' }

  const title = `${character.displayName} — level ${character.level} ${character.characterClass}`

  return {
    title,
    description: `Rank ${character.rank} on the Indiecraft ladder. ${character.nProducts} product${character.nProducts > 1 ? 's' : ''}.`,
    // Non-negotiable rule: an unclaimed sheet is noindex. Claiming unlocks
    // indexing. Consent and the growth loop are the same gesture.
    robots: character.claimed ? undefined : { index: false, follow: false },
    openGraph: {
      title,
      images: [`/api/og/c/${character.handle}?v=${character.level}-${character.ilvl}`],
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function CharacterSheet({ params }: Props) {
  const { handle } = await params
  const character = await getCharacter(handle)

  // Opt-out is applied immediately: opted_out_at → 404, not a grey page.
  if (!character) notFound()

  const { rarity, claimed } = character

  return (
    <main className="page">
      <ViewTracker handle={character.handle} claimed={claimed} />

      <Frame>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Portrait: 2px rarity border. */}
          <div
            className="surface"
            style={{
              width: 96,
              height: 96,
              border: `2px solid ${rarity.hex}`,
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {character.avatarUrl ? (
              // biome-ignore lint/performance/noImgElement: Satori and next/image share no pipeline; visual consistency wins.
              <img
                src={character.avatarUrl}
                alt=""
                width={96}
                height={96}
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <span className="serif" style={{ fontSize: 34, color: rarity.hex }}>
                {character.handle.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>

          <div style={{ flex: '1 1 240px', minWidth: 220 }}>
            <div className="serif" style={{ fontSize: 26, color: rarity.hex }}>
              {character.displayName}
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              @{character.handle} · {character.characterClass}
            </div>

            <div style={{ marginTop: 14 }}>
              <span className="label">Level</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                <span className="serif gold" style={{ fontSize: 64, lineHeight: 1 }}>
                  {character.level}
                </span>
                <IlvlDelta ilvl={character.ilvl} delta={character.ilvlDelta} claimed={claimed} />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="bar">
                <span style={{ width: `${Math.round(character.progress.ratio * 100)}%` }} />
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {character.progress.next === null
                  ? 'Max level reached.'
                  : `${formatUsd(character.progress.next - character.xp)} of XP to level ${character.level + 1}`}
              </div>
            </div>
          </div>

          <div style={{ minWidth: 150 }}>
            <Stat label="Rank" value={`#${character.rank}`} />
            <Stat label="Products" value={String(character.nProducts)} />
            <Stat label="MRR" value={formatUsd(character.mrrUsd)} />
            <Stat label="Lifetime revenue" value={formatUsd(character.revenueTotalUsd)} />
          </div>
        </div>
      </Frame>

      <Section title="Gear">
        {character.equipment.length === 0 ? (
          <p className="muted">No products linked yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {character.equipment.map((piece) => (
              <li
                key={piece.slug}
                className="surface"
                style={{
                  padding: '10px 12px',
                  borderLeft: `2px solid ${piece.rarity.hex}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <span>
                  {/* The dofollow backlink is what claiming buys you. */}
                  {piece.website && claimed ? (
                    <a href={piece.website} style={{ color: piece.rarity.hex }}>
                      {piece.name}
                    </a>
                  ) : (
                    <span style={{ color: piece.rarity.hex }}>{piece.name}</span>
                  )}
                  {piece.vcFunded && (
                    <span className="label" style={{ marginLeft: 8 }}>
                      VC
                    </span>
                  )}
                </span>
                <span className="label">item level {piece.itemLevel}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Achievements — ${character.achievements.length}`}>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 8,
          }}
        >
          {character.achievements.map((earned) => {
            const def = ACHIEVEMENTS_BY_CODE.get(earned.code)
            return (
              <li
                key={earned.code}
                className="surface"
                style={{ padding: '10px 12px', border: `1px solid ${rarity.hex}` }}
              >
                <div className="serif gold" style={{ fontSize: 14 }}>
                  {def?.label ?? earned.code}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {def?.description}
                </div>
              </li>
            )
          })}
        </ul>
      </Section>

      {character.cofounders.length > 0 && (
        <Section title="Guild">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {character.cofounders.map((mate) => (
              <Link key={mate} href={`/c/${mate}`}>
                @{mate}
              </Link>
            ))}
          </div>
        </Section>
      )}

      <hr className="rule" />
      <OptOutButton handle={character.handle} claimed={claimed} />
    </main>
  )
}

/**
 * An unclaimed sheet shows nothing negative: no declining iLvl, no trend.
 * The negative only appears once someone has chosen to be here.
 *
 * The test for every derived label: would this person be happy to screenshot
 * it? If not, it's a bug.
 */
function IlvlDelta({ ilvl, delta, claimed }: { ilvl: number; delta: number; claimed: boolean }) {
  if (delta < 0 && !claimed) {
    return <span className="label">iLvl {ilvl}</span>
  }
  return (
    <span className="label">
      iLvl {ilvl}
      {delta !== 0 && (
        <span className={delta > 0 ? 'positive' : 'muted'} style={{ marginLeft: 6 }}>
          {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderBottom: '1px solid var(--ic-line)', padding: '6px 0' }}>
      <div className="label">{label}</div>
      <div className="serif" style={{ fontSize: 18 }}>
        {value}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 className="serif" style={{ fontSize: 15, letterSpacing: '0.1em', margin: '0 0 10px' }}>
        {title.toUpperCase()}
      </h2>
      {children}
    </section>
  )
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}
