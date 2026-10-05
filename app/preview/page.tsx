import type { Metadata } from 'next'
import Link from 'next/link'
import { InstanceJournal } from '@/components/instance-journal'
import { QuestLog } from '@/components/quest-log'
import { WowIcon } from '@/components/wow-icon'
import {
  CLASS_COLORS,
  CLASS_ICONS,
  computeCharacter,
  equipmentFor,
  equipmentInput,
  instancesFor,
  QUESTS,
  questsFor,
  rarityFor,
  seasonBoard,
  seasonStanding,
  seasonWindowOn,
} from '@/engine'
import type { FounderAggregate, SeasonFounder } from '@/engine/types'
import { realmLabel } from '@/lib/realm'

export const metadata: Metadata = {
  title: 'Preview',
  robots: { index: false, follow: false },
}

/**
 * Fixture sheet for the preview branch.
 * The numbers are scored by the shipped engine. No corpus is loaded.
 */

const DAY = '2026-10-05'

function founder(
  over: Partial<FounderAggregate> & Pick<FounderAggregate, 'handle'>,
): FounderAggregate {
  return {
    revenueTotalUsd: 0,
    mrrUsd: 0,
    last30dUsd: 0,
    customers: 0,
    activeSubscriptions: 0,
    nProducts: 1,
    retention: 0,
    hasRetentionSignal: false,
    effectiveCustomers: 0,
    growthMrr30d: 0,
    domainRating: null,
    followers: null,
    foundedFirst: null,
    channels: [],
    stack: [],
    cofounders: [],
    fundingStatuses: [],
    visitors30d: 0,
    categories: [],
    hasMobileApp: false,
    profitMargin30d: null,
    googleImpressions30d: 0,
    everListedForSale: false,
    allProductsEarning: false,
    realm: null,
    faction: null,
    ...over,
  }
}

const ada = founder({
  handle: 'ada',
  realm: 'FR',
  revenueTotalUsd: 100_000,
  nProducts: 1,
  mrrUsd: 1_500,
  last30dUsd: 2_000,
  customers: 8,
  activeSubscriptions: 4,
  effectiveCustomers: 8,
  hasRetentionSignal: true,
  retention: 0.5,
  domainRating: 18,
  followers: 400,
  visitors30d: 20,
  categories: ['saas'],
  stack: ['next'],
})

const brisk = founder({
  handle: 'brisk',
  realm: 'FR',
  revenueTotalUsd: 800,
  mrrUsd: 6_400,
  last30dUsd: 6_400,
})

const quiet = founder({
  handle: 'quiet',
  realm: 'FR',
  revenueTotalUsd: 40_000,
  mrrUsd: 80,
  last30dUsd: 80,
})

const klaus = founder({
  handle: 'klaus',
  realm: 'DE',
  revenueTotalUsd: 2_000_000,
  mrrUsd: 20_000,
  last30dUsd: 20_000,
})

function peer(aggregate: FounderAggregate, recentUsd: number): SeasonFounder {
  const sheet = computeCharacter(aggregate)
  return {
    handle: aggregate.handle,
    realm: aggregate.realm,
    revenueTotalUsd: aggregate.revenueTotalUsd,
    level: sheet.level,
    characterClass: sheet.class,
    samples: [{ day: '2026-10-04', recentUsd }],
  }
}

function usd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(value)
}

export default function PreviewPage() {
  const sheet = computeCharacter(ada)
  const doll = equipmentFor(equipmentInput(ada, sheet.class))
  const instances = instancesFor(ada, sheet.level)
  const window = seasonWindowOn(DAY)
  const peers = [
    peer(ada, ada.mrrUsd),
    peer(brisk, brisk.mrrUsd),
    peer(quiet, quiet.mrrUsd),
    peer(klaus, klaus.mrrUsd),
  ]
  const season = seasonStanding(peers, window, ada.handle)
  const board = seasonBoard(peers, window, 'FR')
  const quests = questsFor({
    doll,
    listingUrl: 'https://trustmrr.com/founder/ada',
    products: [],
    rank: null,
    realm: null,
    ilvl: sheet.ilvl,
    revenueTotalUsd: ada.revenueTotalUsd,
    earned: [],
    progress: {
      revenueTotalUsd: ada.revenueTotalUsd,
      mrrUsd: ada.mrrUsd,
      customers: ada.customers,
      activeSubscriptions: ada.activeSubscriptions,
      nProducts: ada.nProducts,
      retention: ada.retention,
      hasRetentionSignal: ada.hasRetentionSignal,
      growthMrr30d: ada.growthMrr30d,
      domainRating: ada.domainRating,
      level: sheet.level,
      cofounders: 0,
      visitors30d: ada.visitors30d,
      categories: ada.categories.length,
      stackSize: ada.stack.length,
      profitMargin30d: ada.profitMargin30d,
      googleImpressions30d: ada.googleImpressions30d,
      productsEarning: 0,
    },
    level: sheet.level,
    xp: sheet.xp,
    instances,
    season,
  })
  const shown = quests.slice(0, QUESTS.shown)
  const rest = quests.filter(
    (quest) =>
      (quest.kind === 'instance' || quest.kind === 'season') &&
      !shown.some((row) => row.code === quest.code),
  )

  return (
    <main className="page">
      <header className="page-head">
        <p className="label">Fixture · the engine scored this · no corpus is loaded</p>
        <h1 className="serif gold">@{sheet.handle}</h1>
        <p className="muted">
          Level {sheet.level} {sheet.class} · item level {sheet.ilvl} · {realmLabel('FR')} ·
          lifetime {usd(ada.revenueTotalUsd)}
        </p>
      </header>

      <section className="sheet-section">
        <h2 className="serif">DUNGEONS AND RAIDS</h2>
        <InstanceJournal instances={instances} season={season} />
      </section>

      <QuestLog quests={shown} done={[]} />
      {rest.length > 0 && (
        <>
          <p className="muted">
            The sheet shows the first {QUESTS.shown}. These two sit further down the same log.
          </p>
          <QuestLog quests={rest} done={[]} />
        </>
      )}

      <section className="sheet-section">
        <h2 className="serif">THE SEASON</h2>
        <p className="muted">
          {realmLabel(board.realm)} · {board.window.startsOn} to {board.window.endsOn}. Ordered by
          the latest monthly revenue inside the window. {klaus.handle} is on DE and is not on this
          board. Lifetime revenue does not sort it.
        </p>
        <ol className="ladder">
          {board.rows.map((row) => (
            <li key={row.handle} className="ladder-row">
              <Link href={`/c/${row.handle}`} className="ladder-main">
                <span className="ladder-rank serif">{row.rank}</span>
                <span
                  className="qsquare ladder-level serif"
                  style={{ color: rarityFor(row.level).hex }}
                >
                  {row.level}
                </span>
                <span className="ladder-name" style={{ color: rarityFor(row.level).hex }}>
                  @{row.handle}
                </span>
                <span
                  className="ladder-class label"
                  style={{ color: CLASS_COLORS[row.characterClass] }}
                >
                  <WowIcon
                    slug={CLASS_ICONS[row.characterClass]}
                    glyph={row.characterClass}
                    size={18}
                    bare
                  />
                  {row.characterClass}
                </span>
                <span className="ladder-standing">
                  <span className="ladder-realm serif">{row.realm}</span>
                </span>
                <span className="ladder-ilvl">
                  <span className="ladder-ilvl-value">{usd(row.scoreUsd)}</span> recent
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}
