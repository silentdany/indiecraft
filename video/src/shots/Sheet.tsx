import { Frame } from '@/components/frame'
import { GearItem } from '@/components/gear-item'
import { PaperDoll } from '@/components/paper-doll'
import { QuestLog } from '@/components/quest-log'
import { RankPanel, StatsPanel } from '@/components/sheet-panels'
import { WowIcon } from '@/components/wow-icon'
import { CLASS_COLORS, CLASS_ICONS, CLASS_REASONS, FACTIONS_BY_KEY, QUESTS } from '@/engine'
import type { CharacterPage } from '@/lib/queries'
import { realmLabel } from '@/lib/realm'
import fixture from '../data/character.json'

/**
 * The character sheet, shot for the camera.
 *
 * Every component below is imported from the app — Frame, PaperDoll, GearItem,
 * the two panels, the quest log. Nothing is reimplemented and no styling is
 * added: this file is a shot list, not a second copy of the product. That is
 * what makes a 3x close-up on a stat legible, and it is why the video cannot
 * quietly start showing a UI that no longer exists.
 *
 * What IS reproduced by hand is the surrounding markup of app/c/[handle] —
 * the identity bar, the portrait, the two readouts. The page keeps that inline
 * rather than in a component, so the choice was to copy forty lines or to
 * refactor the page for the benefit of a video. Copying, and saying so: if the
 * header is ever redesigned, this file needs a look. Everything under it
 * follows automatically.
 *
 * The order is the page's own, minus the tab strip. That is four panels of
 * which three are hidden behind a radio input, and nothing is going to click a
 * radio input on camera — so Standing and Statistics are lifted out of the
 * first tab and the achievement grid is left on the floor. If a shot ever
 * wants the achievements, they come back here as a section, not as tabs.
 */

/*
 * A JSON import is `string` where the app's types say `CharacterClass`, and
 * TypeScript is right to complain. The shape is guaranteed by the script that
 * wrote it — it serialised exactly this type — so the cast is a statement about
 * provenance rather than a shrug. Re-run `pnpm snapshot` and it stays true.
 */
export const character = fixture as unknown as CharacterPage

const formatUsd = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)

/** One headline number in the identity strip, the way the reference sets them. */
function Figure({
  value,
  label,
  color,
  zoom,
}: {
  value: string
  label: string
  color?: string
  /** Aimable by name from a ZoomPan stop. */
  zoom?: string
}) {
  return (
    <div className="armory-fig" data-zoom={zoom}>
      <span className="serif" style={color ? { color } : undefined}>
        {value}
      </span>
      <span className="stat-name">{label}</span>
    </div>
  )
}

export function Sheet() {
  const { rarity, ilvlRarity } = character
  const faction = character.profile.faction
    ? FACTIONS_BY_KEY.get(character.profile.faction)
    : undefined
  const shown = character.quests.slice(0, QUESTS.shown)

  return (
    <div className="video-page">
      <Frame className="armory">
        <header className="armory-bar" data-zoom="identity">
          <div className="armory-who">
            <h1 className="sheet-name serif" data-zoom="name">
              {character.displayName}
              {character.cofounders.length > 0 && (
                <span className="armory-guild">&lt;{character.cofounders.length + 1}&gt;</span>
              )}
            </h1>
            <p className="armory-line">
              Level <b>{character.level}</b>{' '}
              <a
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
              </a>
              {character.profile.realm && (
                <>
                  {' — '}
                  <a href={`/ladder?realm=${character.profile.realm}`}>
                    {realmLabel(character.profile.realm)}
                  </a>
                </>
              )}
            </p>
            <p className="sheet-why">{CLASS_REASONS.get(character.characterClass)}</p>
          </div>

          <div className="armory-figures" data-zoom="figures">
            <Figure value={`#${character.rank}`} label="Rank" zoom="rank" />
            <Figure
              value={character.ilvl === null ? '—' : String(character.ilvl)}
              label="Item level"
              color={ilvlRarity?.hex}
              zoom="ilvl"
            />
            <Figure
              value={String(character.achievements.length)}
              label="Achievements"
              color="var(--ic-gold)"
              zoom="achievements"
            />
            <Figure value={formatUsd(character.mrrUsd)} label="MRR" zoom="mrr" />
          </div>
        </header>

        <PaperDoll
          doll={character.doll}
          quests={shown}
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
          <div className="qsquare doll-portrait" style={{ color: rarity.hex }} data-zoom="portrait">
            {character.avatarUrl ? (
              <img src={character.avatarUrl} alt="" width={128} height={128} />
            ) : (
              <span className="serif">{character.handle.slice(0, 1).toUpperCase()}</span>
            )}
          </div>

          <div className="doll-readouts" data-zoom="readouts">
            <span className="sheet-readout" data-zoom="level">
              <span className="serif" style={{ color: rarity.hex }}>
                {character.level}
              </span>
              <span className="stat-name">Level</span>
            </span>
            <span className="sheet-readout">
              <span className="serif" style={{ color: ilvlRarity?.hex ?? 'var(--ic-text-muted)' }}>
                {character.ilvl ?? '—'}
              </span>
              <span className="stat-name">iLvl</span>
            </span>
          </div>

          <p className="doll-filled label">
            {character.equipped.worn} of {character.equipped.total} slots filled
          </p>

          <div className="sheet-progress" data-zoom="progress">
            <div className="bar">
              <span style={{ width: `${Math.round(character.progress.ratio * 100)}%` }} />
            </div>
            <span className="label">
              {character.progress.next === null
                ? 'Max level reached'
                : `${formatUsd(character.progress.next - character.xp)} of XP to level ${character.level + 1}`}
            </span>
          </div>

          <a className="armory-handle label" href={`https://x.com/${character.handle}`}>
            @{character.handle}
          </a>
        </PaperDoll>

        <div className="armory-works" data-zoom="products">
          <h2 className="serif">
            {character.equipment.length === 1 ? 'PRODUCT' : 'PRODUCTS'}
            {character.equipment.length > 0 && (
              <span className="armory-works-count">{character.equipment.length}</span>
            )}
          </h2>
          <ul className="gear">
            {character.equipment.map((piece) => (
              <GearItem key={piece.slug} piece={piece} linked={false} />
            ))}
          </ul>
        </div>
      </Frame>

      <div data-zoom="quests">
        <QuestLog done={character.questsDone} quests={shown} />
      </div>

      <div className="summary" data-zoom="summary">
        {character.rankContext && (
          <section className="summary-panel" data-zoom="standing">
            <h2 className="serif">STANDING</h2>
            <RankPanel
              context={character.rankContext}
              characterClass={character.characterClass}
              mrrUsd={character.mrrUsd}
              handle={character.handle}
            />
          </section>
        )}

        <section className="summary-panel" data-zoom="statistics">
          <h2 className="serif">STATISTICS</h2>
          <StatsPanel
            stats={character.stats}
            mrrUsd={character.mrrUsd}
            revenueTotalUsd={character.revenueTotalUsd}
            nProducts={character.nProducts}
          />
        </section>
      </div>
    </div>
  )
}
