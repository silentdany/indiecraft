/**
 * The one sentence printed on the poster.
 *
 * Share drafts stay silent about a bad rank, because a tweet is signed. The
 * poster is the sheet: the rank is already a number on it, and this line does
 * not repeat it. A level-up replaces the joke only while the sheet still
 * calls it recent.
 */
export function posterLine(input: {
  level: number
  characterClass: string
  mrrUsd: number
  recentLevelUp: number | null
}): string {
  if (input.recentLevelUp !== null) return `DING! Level ${input.recentLevelUp}.`
  const what = input.mrrUsd > 0 ? 'SaaS' : 'side project'
  return `Apparently my ${what} makes me a level ${input.level} ${input.characterClass}.`
}
