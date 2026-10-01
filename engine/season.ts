import { SEASON } from './tuning'
import type {
  SeasonBoard,
  SeasonFounder,
  SeasonSample,
  SeasonStanding,
  SeasonWindow,
} from './types'

const DAY = 86_400_000

/**
 * Realm seasons.
 *
 * Order is the latest monthly-revenue reading inside the window. Lifetime
 * revenue rides along on the row and is not consulted. A founder with no
 * realm is left out. A founder from another realm is not in this board.
 *
 * After the boundary, the finished season is the previous window: same
 * function, different dates, so last season's readings cannot leak in.
 */

function parseDay(iso: string): number {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return Number.NaN
  return Date.UTC(year, month - 1, day)
}

function formatDay(utc: number): string {
  return new Date(utc).toISOString().slice(0, 10)
}

/** The season that contains `day`. */
export function seasonWindowOn(day: string): SeasonWindow {
  const on = parseDay(day)
  const epoch = parseDay(SEASON.epoch)
  const index = Math.floor((on - epoch) / (SEASON.lengthDays * DAY))
  const starts = epoch + index * SEASON.lengthDays * DAY
  const startsOn = formatDay(starts)
  return { id: startsOn, startsOn, endsOn: formatDay(starts + SEASON.lengthDays * DAY) }
}

/** The season that ended where this one starts. */
export function seasonWindowBefore(window: SeasonWindow): SeasonWindow {
  const starts = parseDay(window.startsOn) - SEASON.lengthDays * DAY
  const startsOn = formatDay(starts)
  return { id: startsOn, startsOn, endsOn: window.startsOn }
}

/**
 * A season id is its start date. Anything else — a day in the middle of a
 * season, a word — is not a season, and the caller should fall back to the
 * one that contains today.
 */
export function seasonWindowById(id: string): SeasonWindow | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return null
  const window = seasonWindowOn(id)
  return window.id === id ? window : null
}

/**
 * Latest reading whose day falls inside `[startsOn, endsOn)`.
 *
 * No sample in the window is a score of zero, not a carry-over from the
 * season before it.
 */
export function seasonScore(samples: readonly SeasonSample[], window: SeasonWindow): number {
  let bestDay = ''
  let score = 0
  let found = false
  for (const sample of samples) {
    const day = sample.day.slice(0, 10)
    if (day < window.startsOn || day >= window.endsOn) continue
    if (!found || day >= bestDay) {
      bestDay = day
      score = sample.recentUsd
      found = true
    }
  }
  return found ? score : 0
}

/** One realm's board for one window. Other realms, and founders with none, are absent. */
export function seasonBoard(
  founders: readonly SeasonFounder[],
  window: SeasonWindow,
  realm: string,
): SeasonBoard {
  const rows = founders
    .filter((founder) => founder.realm !== null && founder.realm === realm)
    .map((founder) => ({
      handle: founder.handle,
      realm,
      scoreUsd: seasonScore(founder.samples, window),
      revenueTotalUsd: founder.revenueTotalUsd,
      level: founder.level,
      characterClass: founder.characterClass,
    }))
    .sort((a, b) => b.scoreUsd - a.scoreUsd || a.handle.localeCompare(b.handle))
    .map((row, index) => ({ ...row, rank: index + 1 }))
  return { window, realm, rows }
}

/**
 * Where one founder stands on their own realm.
 *
 * Null when they have no realm, or when they are not in the list. Never a
 * rank on somebody else's realm and never a global pool.
 */
export function seasonStanding(
  founders: readonly SeasonFounder[],
  window: SeasonWindow,
  handle: string,
): SeasonStanding | null {
  const founder = founders.find((entry) => entry.handle === handle)
  if (!founder?.realm) return null
  const board = seasonBoard(founders, window, founder.realm)
  const row = board.rows.find((entry) => entry.handle === handle)
  if (!row) return null
  const above = row.rank > 1 ? board.rows[row.rank - 2] : undefined
  return {
    window,
    realm: founder.realm,
    rank: row.rank,
    total: board.rows.length,
    scoreUsd: row.scoreUsd,
    aboveHandle: above?.handle ?? null,
    aboveScoreUsd: above?.scoreUsd ?? null,
  }
}
