import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'
import { BadgeBlock } from '@/components/badge-block'
import { ConsentActions } from '@/components/consent-actions'
import { Frame } from '@/components/frame'
import { GearItem } from '@/components/gear-item'
import { ACHIEVEMENT_ICONS } from '@/components/icon'
import { JsonLd } from '@/components/json-ld'
import { PaperDoll } from '@/components/paper-doll'
import { RestoreSheet } from '@/components/restore-sheet'
import { ShareSheet } from '@/components/share-sheet'
import {
  HistoryPanel,
  LockedAchievements,
  RankPanel,
  StatsPanel,
  Timeline,
  type TimelineEvent,
} from '@/components/sheet-panels'
import { ViewTracker } from '@/components/view-tracker'
import { WowIcon } from '@/components/wow-icon'
import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_BY_CODE,
  achievementRarityHex,
  CLASS_COLORS,
  CLASS_ICONS,
  CLASS_REASONS,
  FACTIONS_BY_KEY,
} from '@/engine'
import { sessionHandle } from '@/lib/auth'
import { consentActionsEnabled } from '@/lib/consent'
import { getCharacter, wasRemoved } from '@/lib/queries'
import { realmLabel } from '@/lib/realm'

export const revalidate = 86400

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

  const { rarity, ilvlRarity, claimed } = character
  const faction = character.profile.faction
    ? FACTIONS_BY_KEY.get(character.profile.faction)
    : undefined
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

      {/*
        The armory itself: an identity bar, then the character standing inside
        their own gear.

        This used to be two things a screen apart — a portrait card at the top
        and an "Equipment" section far below it — which is a profile page with a
        table attached, not an armory. The single gesture that makes the
        reference read as the reference is that the person is IN the grid. Every
        other change on this page is downstream of that one.
      */}
      <Frame className="armory">
        {/*
          The identity line, then a strip of headline numbers.

          Both lifted from the reference, which runs `Name <Guild>` and a
          level/race/spec/class/realm line, then a row of standalone figures —
          achievement points, gearscore, item level, honorable kills. The strip
          is what makes a header read as an armory rather than as a blog byline,
          and ours carries the four numbers that mean the same things here.
        */}
        <header className="armory-bar">
          <div className="armory-who">
            <h1 className="sheet-name serif">
              {character.displayName}
              {character.cofounders.length > 0 && (
                <span className="armory-guild">&lt;{character.cofounders.length + 1}&gt;</span>
              )}
            </h1>
            <p className="armory-line">
              Level <b>{character.level}</b>{' '}
              {/* The class in its own colour, and the only place on the sheet
                  where it is spelled out — everywhere else the colour does the
                  work on its own. */}
              <Link
                href={`/ladder?class=${character.characterClass}`}
                style={{ color: CLASS_COLORS[character.characterClass] }}
              >
                <WowIcon
                  slug={CLASS_ICONS[character.characterClass]}
                  glyph={character.characterClass}
                  size={20}
                  bare
                />
                {character.characterClass}
              </Link>
              {character.profile.realm && (
                <>
                  {' — '}
                  <Link href={`/ladder?realm=${character.profile.realm}`}>
                    {realmLabel(character.profile.realm)}
                  </Link>
                </>
              )}
            </p>
            {/* The reason was written alongside the rule and never shown, which
                is backwards for a product whose answer to "why did you call me
                that" is "the formula is public, go read it". */}
            <p className="sheet-why">{CLASS_REASONS.get(character.characterClass)}</p>
          </div>

          <div className="armory-figures">
            <Figure value={`#${character.rank}`} label="Rank" />
            <Figure
              value={character.ilvl === null ? '—' : String(character.ilvl)}
              label="Item level"
              color={ilvlRarity?.hex}
            />
            <Figure
              value={String(character.achievements.length)}
              label="Achievements"
              color="var(--ic-gold)"
            />
            <Figure value={formatUsd(character.mrrUsd)} label="MRR" />
          </div>
        </header>

        <PaperDoll
          doll={character.doll}
          tabard={
            faction && {
              label: 'Tabard',
              value: faction.key,
              href: `/ladder?faction=${faction.key}`,
              glyph: faction.key,
              icon: faction.icon,
            }
          }
          shirt={
            character.profile.realm
              ? {
                  label: 'Shirt',
                  value: realmLabel(character.profile.realm),
                  href: `/ladder?realm=${character.profile.realm}`,
                  glyph: 'realm',
                  icon: null,
                }
              : null
          }
        >
          {/* Portrait: the rarity square at its largest, and now where the
              reference puts the character model. */}
          <div className="qsquare doll-portrait" style={{ color: rarity.hex }}>
            {character.avatarUrl ? (
              // biome-ignore lint/performance/noImgElement: Satori and next/image share no pipeline; visual consistency wins.
              <img src={character.avatarUrl} alt="" width={128} height={128} />
            ) : (
              <span className="serif">{character.handle.slice(0, 1).toUpperCase()}</span>
            )}
          </div>

          {/* The two numbers the sheet exists to state, under the portrait
              exactly where level and item level sit in the reference.

              Each wears its OWN band. The iLvl used to wear the level's, which
              meant a level 60 read orange twice and never said anything about
              the gear — and the level itself was a flat butter that agreed with
              neither. One rule now: a number is coloured by the quality of the
              number it is. */}
          <div className="doll-readouts">
            <span className="sheet-readout">
              <span className="serif" style={{ color: rarity.hex }}>
                {character.level}
              </span>
              <span className="stat-name">Level</span>
            </span>
            <span className="sheet-readout">
              <span
                className="serif"
                style={{ color: ilvlRarity?.hex ?? 'var(--ic-text-muted)' }}
                title={
                  character.ilvl === null
                    ? 'No recurring revenue, so there is no monthly score to give.'
                    : undefined
                }
              >
                {character.ilvl ?? '—'}
              </span>
              <span className="stat-name">iLvl</span>
            </span>
          </div>

          {/* What a player actually reads off a paper doll: how many slots are
              filled. This replaced `ilvlDelta`, which compared the item level
              against the character level — two scales that stopped being
              comparable when iLvl became the mean of the worn gear. */}
          <p className="doll-filled label">
            {character.equipped.worn} of {character.equipped.total} slots filled
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

          {/* `Standing` used to render realm and faction here. They moved into
              the tabard and shirt slots, which is where the reference puts
              exactly those two facts.

              The handle is a link out to X now. It was the one piece of
              identity on this page that named a real account and did nothing
              with it, and `rel="me"` is the same claim the JSON-LD `sameAs`
              above already makes — so the markup and the link now agree. */}
          <a
            className="armory-handle label"
            href={`https://x.com/${character.handle}`}
            target="_blank"
            rel="me noreferrer"
          >
            @{character.handle}
          </a>
        </PaperDoll>

        {/*
          Products, inside the frame and under the weapons.

          They spent one revision buried third in a tab panel and one revision
          behind a tab of their own, and the tab was the worse of the two: a tab
          nobody opens is a feature that does not exist. They belong here on the
          merits — the armour is what the numbers say about a founder, the
          weapons are the same, and these are the actual businesses, the only
          thing on the page a visitor can go and use.

          Third register of one object, which is why they sit inside the frame
          with the same rule the weapon rail uses rather than in a section
          below it: gear you wear, weapons you swing, things you built.
        */}
        <div className="armory-works">
          <h2 className="serif">
            {character.equipment.length === 1 ? 'PRODUCT' : 'PRODUCTS'}
            {character.equipment.length > 0 && (
              <span className="armory-works-count">{character.equipment.length}</span>
            )}
          </h2>
          {character.equipment.length === 0 ? (
            <p className="muted">No products linked yet.</p>
          ) : (
            <ul className="gear">
              {character.equipment.map((piece) => (
                <GearItem key={piece.slug} piece={piece} linked={claimed} />
              ))}
            </ul>
          )}
        </div>
      </Frame>

      {/*
        Tabs, because the reference has tabs: Character, Talents, Raid
        Progression, Achievements, PvP, Statistics, History. Ours are the four
        of those we have anything to put in.

        Radio inputs and `:checked`, not JavaScript and not routes. Same reason
        the item tooltips are CSS — the sheet has to work with scripting off —
        and it keeps every panel in the HTML, so a crawler reading this page
        still sees the achievements. Routes would have been the other honest
        answer and would have cost four URLs per founder for one page of
        content.
      */}
      <div className="sheettabs">
        <input type="radio" name="sheettab" id="tab-character" defaultChecked />
        <input type="radio" name="sheettab" id="tab-ach" />
        <input type="radio" name="sheettab" id="tab-history" />
        <input type="radio" name="sheettab" id="tab-share" />

        <nav className="tabs" aria-label="Sheet sections">
          <label className="tab" htmlFor="tab-character">
            Character
          </label>
          <label className="tab" htmlFor="tab-ach">
            Achievements <span className="tab-count">{character.achievements.length}</span>
          </label>
          <label className="tab" htmlFor="tab-history">
            History
          </label>
          <label className="tab" htmlFor="tab-share">
            Share
          </label>
        </nav>

        <div className="tabpanels">
          <div className="tabpanel" data-tab="character">
            {/*
              Standing and Stats side by side rather than stacked.

              They were two number grids one under the other, which read as the
              same panel printed twice — a visitor scrolling past could not tell
              which numbers placed this founder against everybody else and which
              only described them. Splitting them across one row makes the
              difference structural: position on the left, measurements on the
              right, and the eye does not have to work it out.
            */}
            <div className="summary">
              {character.rankContext && (
                <section className="summary-panel">
                  <h2 className="serif">STANDING</h2>
                  <RankPanel
                    context={character.rankContext}
                    characterClass={character.characterClass}
                    mrrUsd={character.mrrUsd}
                    handle={character.handle}
                  />
                </section>
              )}

              <section className="summary-panel">
                <h2 className="serif">STATISTICS</h2>
                <StatsPanel
                  stats={character.stats}
                  mrrUsd={character.mrrUsd}
                  revenueTotalUsd={character.revenueTotalUsd}
                  nProducts={character.nProducts}
                />
              </section>
            </div>

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
          </div>

          <div className="tabpanel" data-tab="ach">
            <Section
              title={`Achievements — ${character.achievements.length} of ${ACHIEVEMENTS.length}`}
            >
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
                        <WowIcon
                          slug={def?.icon ?? null}
                          glyph={ACHIEVEMENT_ICONS[earned.code] ?? 'achievement'}
                          size={32}
                          className="ach-icon"
                        />
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
          </div>

          <div className="tabpanel" data-tab="history">
            <Section title="Watched">
              <HistoryPanel history={character.history} />
            </Section>
            {timeline.length > 0 && (
              <Section title="Career">
                <Timeline events={timeline} backfilled={backfilled} />
              </Section>
            )}
          </div>

          {/*
            Share and Badge, together in a tab.

            Share began under the header as the primary action, which pushed
            every number a visitor came for below the fold — drawing it as a
            real post is what made it legible and also what made it 496px tall.
            It then moved to the foot, out of the way but still 500px of call to
            action that everybody scrolled past to reach the end of the page.

            A tab is the honest answer: nothing to scroll past, and one click
            away for the only person who wants it, which is the founder
            themselves. The panel is still in the HTML either way.
          */}
          <div className="tabpanel" data-tab="share">
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
          </div>
        </div>
      </div>

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

/** One headline number in the identity strip, the way the reference sets them. */
function Figure({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="armory-fig">
      <span className="serif" style={color ? { color } : undefined}>
        {value}
      </span>
      <span className="stat-name">{label}</span>
    </div>
  )
}

/**
 * A titled block. The rule under the heading is the reference's own section
 * divider, and the uppercase serif is the same one the tab strip uses.
 *
 * The styling moved to globals.css rather than staying inline: `.sheet-section`
 * is now used often enough on one page that six copies of the same object
 * literal were shipping in the HTML, and a section heading is furniture, not a
 * one-off.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="sheet-section">
      <h2 className="serif">{title.toUpperCase()}</h2>
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
