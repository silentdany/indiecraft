import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Frame } from '@/components/frame'
import { OptOutButton } from '@/components/opt-out-button'
import { ViewTracker } from '@/components/view-tracker'
import { ACHIEVEMENTS, ACHIEVEMENTS_BY_CODE, CLASS_REASONS } from '@/engine'
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
  const earnedCodes = new Set(character.achievements.map((a) => a.code))
  const locked = ACHIEVEMENTS.filter((def) => !earnedCodes.has(def.code))

  return (
    <main className="page">
      <ViewTracker handle={character.handle} claimed={claimed} />

      <Frame>
        <div className="sheet-head">
          {/* Portrait: the rarity square at its largest. */}
          <div className="qsquare sheet-portrait" style={{ color: rarity.hex }}>
            {character.avatarUrl ? (
              // biome-ignore lint/performance/noImgElement: Satori and next/image share no pipeline; visual consistency wins.
              <img src={character.avatarUrl} alt="" width={96} height={96} />
            ) : (
              <span className="serif" style={{ fontSize: 34 }}>
                {character.handle.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>

          <div className="sheet-identity">
            <div className="sheet-topline">
              <div>
                <p className="sheet-eyebrow">{character.characterClass}</p>
                {/* The reason was written alongside the rule and never shown,
                    which is backwards for a product whose answer to "why did
                    you call me that" is "the formula is public, go read it". */}
                <p className="sheet-why">{CLASS_REASONS.get(character.characterClass)}</p>
                <h1 className="sheet-name serif">{character.displayName}</h1>
              </div>

              {/* The two numbers the sheet exists to state. */}
              <div className="sheet-readouts">
                <span className="sheet-readout">
                  <span className="serif" style={{ color: 'var(--ic-butter)' }}>
                    {character.level}
                  </span>
                  <span className="stat-name">Level</span>
                </span>
                <span className="sheet-readout">
                  <span
                    className="serif"
                    style={{ color: character.ilvl === null ? 'var(--ic-text-muted)' : rarity.hex }}
                    title={
                      character.ilvl === null
                        ? 'No recurring revenue, so there is no monthly score to give.'
                        : undefined
                    }
                  >
                    {character.ilvl ?? '—'}
                  </span>
                  <span className="stat-name">iLvl</span>
                  <IlvlDelta delta={character.ilvlDelta} claimed={claimed} />
                </span>
              </div>
            </div>

            <p className="sheet-meta">
              @{character.handle} · rank <span className="gold">#{character.rank}</span> ·{' '}
              {character.nProducts} product{character.nProducts === 1 ? '' : 's'} ·{' '}
              {formatUsd(character.mrrUsd)} MRR · {formatUsd(character.revenueTotalUsd)} lifetime
            </p>

            <div className="sheet-progress">
              <div className="bar">
                <span style={{ width: `${Math.round(character.progress.ratio * 100)}%` }} />
              </div>
              <span className="label">
                {character.progress.next === null
                  ? 'Max level reached'
                  : `${formatUsd(character.progress.next - character.xp)} of XP to level ${character.level + 1}`}
              </span>
            </div>
          </div>
        </div>
      </Frame>

      <Section title="Gear">
        {character.equipment.length === 0 ? (
          <p className="muted">No products linked yet.</p>
        ) : (
          <ul className="gear">
            {character.equipment.map((piece) => (
              <li key={piece.slug} className="gear-row">
                {/* Icon and name carry the same quality colour, as on a real
                    item: the border is the whole label. */}
                <div className="qsquare gear-icon" style={{ color: piece.rarity.hex }}>
                  {piece.iconUrl ? (
                    // biome-ignore lint/performance/noImgElement: Satori and next/image share no pipeline; visual consistency wins.
                    <img src={piece.iconUrl} alt="" width={56} height={56} />
                  ) : (
                    <span className="serif">{piece.name.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>

                <div className="gear-body">
                  {/* The dofollow backlink is what claiming buys you. */}
                  {piece.website && claimed ? (
                    <a
                      href={piece.website}
                      className="gear-name"
                      style={{ color: piece.rarity.hex }}
                    >
                      {piece.name}
                    </a>
                  ) : (
                    <span className="gear-name" style={{ color: piece.rarity.hex }}>
                      {piece.name}
                    </span>
                  )}
                  <div className="gear-sub">
                    <span className="label">
                      {piece.itemLevel === null
                        ? 'no monthly score'
                        : `item level ${piece.itemLevel}`}
                    </span>
                    {piece.vcFunded && <span className="gear-flag">VC</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Achievements — ${character.achievements.length} of ${ACHIEVEMENTS.length}`}>
        <ul className="ach">
          {character.achievements.map((earned) => {
            const def = ACHIEVEMENTS_BY_CODE.get(earned.code)
            return (
              <li key={earned.code} className="ach-card">
                <div className="ach-title serif">{def?.label ?? earned.code}</div>
                <div className="ach-desc">{def?.description}</div>
              </li>
            )
          })}
        </ul>

        {/*
          What is left to earn, dimmed. Every achievement is phrased as
          something gained, so listing the unearned ones reads as a set of goals
          rather than a verdict — which is the same reason the game shows them.
          It also gives the sheet a second half: without it the page ended a
          third of the way down for anyone with a handful of achievements.
        */}
        {locked.length > 0 && (
          <>
            <p className="ach-locked-head label">Still to earn</p>
            <ul className="ach ach-locked">
              {locked.map((def) => (
                <li key={def.code} className="ach-card">
                  <div className="ach-title serif">{def.label}</div>
                  <div className="ach-desc">{def.description}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      {character.cofounders.length > 0 && (
        <Section title="Guild">
          <div className="guild">
            {character.cofounders.map((mate) => (
              <Link key={mate} href={`/c/${mate}`}>
                <span className="qsquare serif" aria-hidden="true">
                  {mate.slice(0, 1).toUpperCase()}
                </span>
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
function IlvlDelta({ delta, claimed }: { delta: number | null; claimed: boolean }) {
  if (delta === null) return null
  if (delta === 0 || (delta < 0 && !claimed)) return null
  return (
    <span className={delta > 0 ? 'positive' : 'muted'} style={{ fontSize: 12 }}>
      {delta > 0 ? `+${delta}` : delta}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 30 }}>
      <h2
        className="serif"
        style={{
          fontSize: 16,
          letterSpacing: '0.14em',
          margin: '0 0 12px',
          paddingBottom: 8,
          borderBottom: '1px solid var(--ic-line-2)',
        }}
      >
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
