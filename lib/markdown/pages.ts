import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_BY_CODE,
  CLASS_RULES,
  FACTIONS,
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  RARITY_BANDS,
  SLOTS,
} from '../../engine/tuning'
import { realmLabel } from '../realm'
import { CANONICAL_ORIGIN } from './site'

/**
 * The same pages, as prose.
 *
 * These are not summaries and not a second product: an agent asking for
 * markdown gets the facts the HTML page is built from, in the order the page
 * puts them, and nothing the page does not say. The armory costs 116 KB of
 * markup to state about a kilobyte of fact; this is the kilobyte.
 *
 * Every renderer here is pure — data in, string out — which is what lets them
 * live under the test rule in vitest.config.mts. The route handler does the
 * fetching.
 *
 * Links are absolute. A markdown body gets saved, quoted and re-fetched away
 * from the request that produced it, and a relative link only works while it
 * still remembers where it came from.
 */

const num = (n: number): string => n.toLocaleString('en-US')
const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`

/** An empty cell is an answer. `null` in a table is a leak. */
const cell = (v: string | number | null | undefined): string =>
  v === null || v === undefined ? '' : String(v)

export interface LadderRowInput {
  rank: number
  handle: string
  level: number
  ilvl: number | null
  characterClass: string
  nProducts: number
  realm: string | null
  faction: string | null
}

function ladderTable(rows: readonly LadderRowInput[]): string[] {
  return [
    '| Rank | Founder | Level | iLvl | Class | Products | Realm | Faction |',
    '| ---: | --- | ---: | ---: | --- | ---: | --- | --- |',
    ...rows.map(
      (r) =>
        `| ${r.rank} | ${r.handle} | ${r.level} | ${cell(r.ilvl)} | ${r.characterClass} | ${r.nProducts} | ${cell(r.realm)} | ${cell(r.faction)} |`,
    ),
  ]
}

export interface HomeInput {
  stats: {
    characters: number
    maxLevel: number
    trackedMrrUsd: number
    products: number
    achievements: number
  }
  top: readonly LadderRowInput[]
  factions: readonly { value: string; count: number }[]
  classes: readonly { name: string; count: number }[]
  realms: readonly { value: string; count: number }[]
}

export function homeMarkdown(input: HomeInput): string {
  const { stats } = input
  return [
    '# World of Indiecraft',
    '',
    "A public armory for indie founders, built on TrustMRR data. Lifetime revenue is XP, every stat is an equipment slot, and item level is the average of a founder's gear.",
    '',
    '## Realm status',
    '',
    `- Characters: ${num(stats.characters)}`,
    `- Highest level: ${stats.maxLevel}`,
    `- Tracked MRR: ${usd(stats.trackedMrrUsd)}`,
    `- Products: ${num(stats.products)}`,
    `- Achievements earned: ${num(stats.achievements)}`,
    '',
    '## The ladder',
    '',
    ...ladderTable(input.top),
    '',
    `Full list: ${CANONICAL_ORIGIN}/ladder`,
    '',
    '## Factions',
    '',
    ...input.factions.map((f) => `- ${f.value}: ${num(f.count)} founders`),
    '',
    '## Classes',
    '',
    ...input.classes.map((c) => `- ${c.name}: ${num(c.count)} founders`),
    '',
    '## Realms',
    '',
    ...input.realms.map((r) => `- ${realmLabel(r.value)} (${r.value}): ${num(r.count)} founders`),
    '',
    `How every number here is worked out: ${CANONICAL_ORIGIN}/rules`,
    '',
  ].join('\n')
}

export interface LadderInput {
  rows: readonly LadderRowInput[]
  total: number
  filterLabel?: string | null
}

export function ladderMarkdown({ rows, total, filterLabel }: LadderInput): string {
  return [
    '# The ladder',
    '',
    filterLabel
      ? `${num(total)} founders matching ${filterLabel}, ranked by level then item level.`
      : `${num(total)} founders, ranked by level then item level.`,
    '',
    ...ladderTable(rows),
    '',
    `Each founder has a sheet at ${CANONICAL_ORIGIN}/c/<their handle>.`,
    `How the ranking works: ${CANONICAL_ORIGIN}/rules`,
    '',
  ].join('\n')
}

export interface CharacterInput {
  handle: string
  displayName: string
  level: number
  ilvl: number | null
  characterClass: string
  rarity: { name: string; hex: string }
  xp: number
  nProducts: number
  mrrUsd: number
  revenueTotalUsd: number
  rank: number
  profile: { realm: string | null; faction: string | null }
  stats: {
    last30dUsd: number
    arpu: number | null
    growthMrr30d: number | null
    domainRating: number | null
    followers: number | null
    age: number | null
    customers: number | null
    retention: number | null
  }
  equipment: readonly {
    name: string
    website: string | null
    mrrUsd: number
    itemLevel: number | null
    rarity: { name: string; hex: string }
  }[]
  achievements: readonly { code: string; earnedOn: string }[]
  computedAt: string
}

export function characterMarkdown(c: CharacterInput): string {
  const stat = (label: string, value: string | number | null | undefined): string | null =>
    value === null || value === undefined ? null : `- ${label}: ${value}`

  return [
    `# ${c.displayName}`,
    '',
    `Handle: ${c.handle} · Level ${c.level} ${c.characterClass} · Rank #${c.rank}`,
    '',
    '## Character',
    '',
    `- Level: ${c.level} of ${MAX_LEVEL} (${c.rarity.name})`,
    `- Item level: ${cell(c.ilvl)}`,
    `- Class: ${c.characterClass}`,
    `- Realm: ${c.profile.realm ? `${realmLabel(c.profile.realm)} (${c.profile.realm})` : 'unassigned'}`,
    `- Faction: ${c.profile.faction ?? 'unassigned'}`,
    `- XP (lifetime revenue): ${usd(c.xp)}`,
    `- MRR: ${usd(c.mrrUsd)}`,
    `- Lifetime revenue: ${usd(c.revenueTotalUsd)}`,
    `- Products: ${c.nProducts}`,
    '',
    '## Stats',
    '',
    ...([
      stat('Last 30 days', usd(c.stats.last30dUsd)),
      stat('ARPU', c.stats.arpu === null ? null : usd(c.stats.arpu)),
      stat('Customers', c.stats.customers === null ? null : num(c.stats.customers)),
      stat('Domain rating', c.stats.domainRating),
      stat('Followers', c.stats.followers === null ? null : num(c.stats.followers)),
      stat('Age (years)', c.stats.age),
    ].filter(Boolean) as string[]),
    '',
    '## Equipment',
    '',
    '| Product | Item level | Quality | MRR |',
    '| --- | ---: | --- | ---: |',
    ...c.equipment.map(
      (e) => `| ${e.name} | ${cell(e.itemLevel)} | ${e.rarity.name} | ${usd(e.mrrUsd)} |`,
    ),
    '',
    '## Achievements',
    '',
    ...(c.achievements.length > 0
      ? c.achievements.map((a) => {
          const def = ACHIEVEMENTS_BY_CODE.get(a.code)
          return `- ${def?.label ?? a.code} — ${def?.description ?? ''} (earned ${a.earnedOn})`
        })
      : ['None yet.']),
    '',
    `Computed ${c.computedAt.slice(0, 10)}. Numbers refresh once a night.`,
    `How every number here is worked out: ${CANONICAL_ORIGIN}/rules`,
    '',
  ].join('\n')
}

/**
 * The rules, straight off the engine constants the HTML page reads.
 *
 * Reproducing the tuning here rather than describing it is the point: this is
 * the file that tells an agent why a founder is level 47, and a paraphrase of
 * the level table would be wrong the first time somebody retunes it.
 */
export function rulesMarkdown(): string {
  const levelRows = LEVEL_THRESHOLDS.map(
    (threshold, index) => `| ${index + 1} | ${usd(threshold)} |`,
  )

  return [
    '# The rules',
    '',
    'Every number on World of Indiecraft, and how it is worked out. Nothing here is self-reported: the figures come from the TrustMRR corpus and are recomputed once a night.',
    '',
    '## Levels',
    '',
    `Lifetime revenue is XP. There are ${MAX_LEVEL} levels; each row is the lifetime revenue needed to reach it.`,
    '',
    '| Level | Lifetime revenue |',
    '| ---: | ---: |',
    ...levelRows,
    '',
    '## Quality bands',
    '',
    'A character takes its quality colour from its level.',
    '',
    ...RARITY_BANDS.map((band) => `- ${band.rarity.name}: level ${band.minLevel} and above`),
    '',
    '## Classes',
    '',
    'Class is decided by the first rule that matches, top down.',
    '',
    ...CLASS_RULES.map((rule) => `- ${rule.class} — ${rule.condition}. ${rule.reason}`),
    '',
    '## Factions',
    '',
    ...FACTIONS.map((faction) => `- ${faction.key} — ${faction.tagline}`),
    '',
    '## Equipment slots',
    '',
    `${SLOTS.length} slots, one per stat. An empty slot is part of the answer.`,
    '',
    '| Slot | Stat | How it is filled |',
    '| --- | --- | --- |',
    ...SLOTS.map((slot) => `| ${slot.label} | ${slot.stat} | ${slot.fill} |`),
    '',
    '## Achievements',
    '',
    `${ACHIEVEMENTS.length} achievements. Earned once, never revoked.`,
    '',
    ...ACHIEVEMENTS.map((a) => `- ${a.label} (${a.rarity}) — ${a.description}`),
    '',
  ].join('\n')
}
