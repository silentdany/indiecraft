/**
 * What a founder actually posts.
 *
 * The old share button carried one sentence for all 142 of them — "Level 56
 * Paladin, rank #13 on the World of Indiecraft armory." It is accurate, it is
 * the shape of a system notification, and nobody has ever posted a system
 * notification on purpose.
 *
 * These are written the way the people in this dataset actually write: first
 * person, short, one fact, faintly amused at being given a character class.
 * Three rules the whole file follows.
 *
 *   Never state a number that is not a flex. "Rank #122 of 142" is true and
 *   posting it is self-harm; a founder low on the global ladder is offered
 *   their realm, their class, or the joke instead. There is no version of this
 *   that asks somebody to advertise being last.
 *
 *   Never invent. Every candidate is built from a value the sheet already
 *   shows, and one that is missing simply produces no candidate.
 *
 *   No URL in the text. X appends it from the intent's `url` parameter, and a
 *   link pasted twice renders twice.
 *
 * Pure, and tested, because this is copy that changes with data — the class of
 * thing that quietly starts lying after a refactor and never throws.
 */

export interface ShareFacts {
  level: number
  ilvl: number | null
  characterClass: string
  rank: number
  total: number
  classRank: number
  classTotal: number
  realm: { name: string; rank: number; total: number } | null
  achievements: number
  achievementsTotal: number
  /** The level just reached, when it happened in the last week. */
  recentLevelUp: number | null
  /** The label of an achievement earned since we first saw them. */
  recentAchievement: string | null
  growthMrr30d: number | null
  mrrUsd: number
}

export interface SharePost {
  /** Stable across renders so React keys and analytics can name the angle. */
  key: string
  text: string
}

/**
 * Every post worth offering, strongest first.
 *
 * The caller shows the first one and lets people cycle. Order is the editorial
 * judgement: an event beats a standing, a standing beats a joke, and the joke
 * is always last but always present — it is the only one that works for a
 * founder with nothing yet to boast about.
 */
export function sharePosts(facts: ShareFacts): SharePost[] {
  const posts: SharePost[] = []
  // Capitalised, as the card sitting next to this text spells it. Lowercase is
  // arguably better English for a class name, and it read as a typo directly
  // beneath a badge saying PALADIN.
  const cls = facts.characterClass
  const add = (key: string, text: string) => posts.push({ key, text })

  // --- Events. Something changed, which is the only reason to post twice.
  if (facts.recentLevelUp !== null) {
    add('levelup', `DING! Level ${facts.recentLevelUp}. My business, as a character sheet:`)
  }
  if (facts.recentAchievement) {
    add('achievement', `Achievement unlocked: ${facts.recentAchievement}.`)
  }

  // --- Standings, each offered only where it is genuinely good news.
  if (facts.rank <= 10) {
    add('top10', `Rank #${facts.rank} of ${facts.total} founders. I'll take it.`)
  } else if (facts.rank <= Math.ceil(facts.total * 0.1)) {
    // Strictly the top tenth, with no generous floor. A floor of 20 was there
    // to be kind on a big ladder and quietly lied on a small one: rank 20 of 25
    // is not the top 10% of anything, and the one thing a sentence somebody
    // signs their name to may not be is false.
    add('topten', `Top 10% of ${facts.total} indie founders, apparently.`)
  }

  if (facts.realm && facts.realm.rank <= 3 && facts.realm.total >= 3) {
    add(
      'realm',
      `${ordinal(facts.realm.rank)} of ${facts.realm.total} founders in ${facts.realm.name}.`,
    )
  }

  if (facts.classRank <= 3 && facts.classTotal >= 5) {
    add(
      'class',
      `${ordinal(facts.classRank)} of ${facts.classTotal} ${cls}s on the Indiecraft ladder.`,
    )
  }

  if (facts.level >= 50) {
    add('level', `Level ${facts.level} ${cls}. Lifetime revenue is XP, so this one is earned.`)
  }

  if (facts.growthMrr30d !== null && facts.growthMrr30d >= 10) {
    add(
      'growth',
      `+${facts.growthMrr30d.toFixed(0)}% MRR over thirty days. Item level is climbing.`,
    )
  }

  if (facts.achievements >= Math.ceil(facts.achievementsTotal * 0.6)) {
    add(
      'achievements',
      `${facts.achievements} of ${facts.achievementsTotal} achievements. Still hunting the rest.`,
    )
  }

  // --- Always available, and for a founder with no standing worth posting it
  // --- is the only one. It is also, reliably, the one people actually post.
  add('joke', `Apparently my ${revenueWord(facts.mrrUsd)} makes me a level ${facts.level} ${cls}.`)

  return posts
}

/** "1st", "2nd", "3rd". Only ever called with 1–3, but correct past that anyway. */
function ordinal(n: number): string {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/**
 * "SaaS" reads wrong for somebody selling templates once, and this line is the
 * fallback everybody sees — so it says the vaguest true thing instead.
 */
function revenueWord(mrrUsd: number): string {
  return mrrUsd > 0 ? 'SaaS' : 'side project'
}
