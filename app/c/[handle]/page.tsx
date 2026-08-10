import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'
import { BadgeBlock } from '@/components/badge-block'
import { ConsentActions } from '@/components/consent-actions'
import { Frame } from '@/components/frame'
import { GearItem } from '@/components/gear-item'
import { ACHIEVEMENT_ICONS, Icon } from '@/components/icon'
import { JsonLd } from '@/components/json-ld'
import { RestoreSheet } from '@/components/restore-sheet'
import { ShareSheet } from '@/components/share-sheet'
import {
  HistoryPanel,
  LockedAchievements,
  RankPanel,
  Standing,
  StatsPanel,
  Timeline,
  type TimelineEvent,
} from '@/components/sheet-panels'
import { ViewTracker } from '@/components/view-tracker'
import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_BY_CODE,
  achievementRarityHex,
  CLASS_COLORS,
  CLASS_REASONS,
} from '@/engine'
import { sessionHandle } from '@/lib/auth'
import { consentActionsEnabled } from '@/lib/consent'
import { getCharacter, wasRemoved } from '@/lib/queries'
import { realmLabel } from '@/lib/realm'

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
    alternates: { canonical: `/c/${character.handle}` },
    // No `images` here on purpose. opengraph-image.tsx in this same segment
    // supplies the URL along with its width, height and type, and naming one
    // here would override that with a bare URL missing all three. Its
    // `generateImageMetadata` handles the cache-busting the `?v=` query used to
    // do — X caches a card against its URL and never re-fetches it.
    openGraph: {
      type: 'profile',
      title,
      url: `/c/${character.handle}`,
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function CharacterSheet({ params }: Props) {
  const { handle } = await params
  const character = await getCharacter(handle)

  if (!character) {
    /*
     * Removal is still a 404 to the world — that part does not soften.
     *
     * But it was also a 404 to the person who removed it, which made an
     * accidental click permanent: no page left to change your mind on. Signed
     * in as this exact handle, and only then, the 404 becomes a way back.
     */
    const viewer = await sessionHandle()
    if (viewer && viewer === handle.replace(/^@/, '').toLowerCase() && (await wasRemoved(handle))) {
      return (
        <main className="page">
          <header className="page-head">
            <h1 className="serif gold">SHEET REMOVED</h1>
          </header>
          <RestoreSheet handle={viewer} viewer={viewer} />
        </main>
      )
    }
    // Opt-out is applied immediately: opted_out_at → 404, not a grey page.
    notFound()
  }

  const { rarity, claimed } = character
  const earnedCodes = new Set(character.achievements.map((a) => a.code))

  /*
   * Every achievement is retroactive, so the first compute stamps them all with
   * the day we first saw the founder. Those are not events — listing fifteen
   * identical timestamps would say nothing happened. They fold into the entry
   * line, and only what has happened since earns a row.
   */
  const seenDay = character.firstSeenAt.slice(0, 10)
  const since = character.achievements.filter((a) => a.earnedOn.slice(0, 10) > seenDay)
  const backfilled = character.achievements.length - since.length

  const timeline: TimelineEvent[] = [
    ...since.map((a) => ({
      at: a.earnedOn,
      kind: 'achievement' as const,
      label: `Earned ${ACHIEVEMENTS_BY_CODE.get(a.code)?.label ?? a.code}`,
    })),
    ...(character.leveledAt
      ? [
          {
            at: character.leveledAt,
            kind: 'level' as const,
            label: character.previousLevel
              ? `Reached level ${character.level}, up from ${character.previousLevel}`
              : `Reached level ${character.level}`,
          },
        ]
      : []),
    { at: character.firstSeenAt, kind: 'joined' as const, label: 'Entered the armory' },
  ].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <main className="page">
      <ViewTracker handle={character.handle} claimed={claimed} />

      {/*
        Claimed sheets only. An unclaimed one is `noindex`, so structured data
        about that person would be describing them to machines on a page that
        asks the same machines to forget it — and consent is the whole reason
        the noindex is there.
      */}
      {claimed && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            dateModified: new Date().toISOString(),
            mainEntity: {
              '@type': 'Person',
              name: character.displayName,
              alternateName: `@${character.handle}`,
              url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/c/${character.handle}`,
              image: character.avatarUrl ?? undefined,
              sameAs: [`https://x.com/${character.handle}`],
            },
          }}
        />
      )}

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
                {/* The class in its own colour, and the only place on the sheet
                    where it is spelled out — everywhere else the colour does
                    the work on its own. */}
                <Link
                  href={`/ladder?class=${character.characterClass}`}
                  className="sheet-eyebrow"
                  style={{ color: CLASS_COLORS[character.characterClass] }}
                >
                  <Icon name={character.characterClass} size={15} />
                  {character.characterClass}
                </Link>
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
              {character.nProducts} product
              {character.nProducts === 1 ? '' : 's'} · {formatUsd(character.mrrUsd)} MRR ·{' '}
              {formatUsd(character.revenueTotalUsd)} lifetime
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

            <Standing profile={character.profile} />
          </div>
        </div>
      </Frame>

      {character.rankContext && (
        <RankPanel
          context={character.rankContext}
          characterClass={character.characterClass}
          mrrUsd={character.mrrUsd}
          handle={character.handle}
        />
      )}

      <Section title="Stats">
        <StatsPanel stats={character.stats} />
        <HistoryPanel history={character.history} />
      </Section>

      <Section title="Gear">
        {character.equipment.length === 0 ? (
          <p className="muted">No products linked yet.</p>
        ) : (
          <ul className="gear">
            {character.equipment.map((piece) => (
              <GearItem key={piece.slug} piece={piece} linked={claimed} />
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Achievements — ${character.achievements.length} of ${ACHIEVEMENTS.length}`}>
        <ul className="ach">
          {character.achievements.map((earned) => {
            const def = ACHIEVEMENTS_BY_CODE.get(earned.code)
            return (
              <li
                key={earned.code}
                className="ach-card"
                style={{ '--ach-color': achievementRarityHex(def?.rarity) } as CSSProperties}
              >
                {/* Every earned badge is a link to everybody else who holds it.
                    A ladder filter nobody can find is a query parameter, not a
                    feature, and the sheet is where somebody is already looking
                    at the badge they want the company of. */}
                <Link href={`/ladder?ach=${earned.code}`} className="ach-link">
                  <span className="qsquare ach-icon">
                    <Icon name={ACHIEVEMENT_ICONS[earned.code] ?? 'achievement'} size={17} />
                  </span>
                  <span className="ach-body">
                    <span className="ach-title serif">{def?.label ?? earned.code}</span>
                    <span className="ach-desc">{def?.description}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>

        <LockedAchievements earned={earnedCodes} input={character.progressInput} />
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

      {timeline.length > 0 && (
        <Section title="History">
          <Timeline events={timeline} backfilled={backfilled} />
        </Section>
      )}

      {/*
        Share and Badge together at the foot: the two things you do WITH a
        sheet, after the sheet itself.

        Share used to sit directly under the header, as the primary action.
        Drawing it as an actual post is what made it legible and also what made
        it 496px tall — enough to push the rank panel below the fold on a laptop
        and bury every number a visitor came for. A call to action nobody has
        read the page for yet is just an obstacle; a founder who wants to post
        their sheet will scroll.
      */}
      <ShareSheet
        handle={character.handle}
        displayName={character.displayName}
        avatarUrl={character.avatarUrl}
        level={character.level}
        ilvl={character.ilvl}
        characterClass={character.characterClass}
        facts={{
          level: character.level,
          ilvl: character.ilvl,
          characterClass: character.characterClass,
          rank: character.rank,
          total: character.rankContext?.total ?? 0,
          classRank: character.rankContext?.classRank ?? 0,
          classTotal: character.rankContext?.classTotal ?? 0,
          realm: character.rankContext?.realmRank
            ? {
                name: realmLabel(character.rankContext.realmRank.realm),
                rank: character.rankContext.realmRank.rank,
                total: character.rankContext.realmRank.total,
              }
            : null,
          achievements: character.achievements.length,
          achievementsTotal: ACHIEVEMENTS.length,
          recentLevelUp: character.recentLevelUp?.level ?? null,
          recentAchievement: character.recentAchievement
            ? (ACHIEVEMENTS_BY_CODE.get(character.recentAchievement.code)?.label ?? null)
            : null,
          growthMrr30d: character.stats.growthMrr30d,
          mrrUsd: character.mrrUsd,
        }}
      />

      <Section title="Badge">
        <BadgeBlock
          handle={character.handle}
          level={character.level}
          characterClass={character.characterClass}
        />
      </Section>

      {consentActionsEnabled() && (
        <>
          <hr className="rule" />
          <ConsentActions
            handle={character.handle}
            claimed={claimed}
            viewer={await sessionHandle()}
            enabled
          />
        </>
      )}
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
