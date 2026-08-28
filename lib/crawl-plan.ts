/**
 * What the crawler collects tonight, decided as pure data.
 *
 * Lives here rather than in scripts/crawl.ts because it is the one part of the
 * run that has no database and no network in it — and because getting it wrong
 * does not throw. It hands back a list, the crawler works down that list until
 * the workflow's ceiling arrives, and a list in the wrong order or the wrong
 * length simply means the night collected the wrong things.
 */

export interface PlanInput {
  /** The API's ranked list, best rank first. */
  ranked: string[]
  /** Products of founders who claimed a sheet, soonest deadline first. */
  owed: string[]
  /** Every slug TrustMRR publishes, from the sitemap. */
  discovered: string[]
  /** startup_slug → last `captured_on`. Absent means never collected. */
  lastSeen: Map<string, string>
  /** How many slugs this run may collect in total. */
  budget: number
  /**
   * How many of `ranked` count as the ladder and get refreshed tonight.
   *
   * Distinct from `budget` on purpose: without a ceiling of its own the ranked
   * list eats the whole night and nothing new is ever discovered.
   */
  ladder: number
}

export interface RunPlan {
  /** The night's queue, in the order it should be worked. */
  slugs: string[]
  /** Claimed founders' products, which are not already on the ladder. */
  priority: string[]
  /** The ranked slice that gets refreshed tonight. */
  ladder: string[]
  /** The stalest of everything else, filling whatever room is left. */
  rotating: string[]
  /** Of `rotating`, how many have never been captured at all. */
  fresh: number
}

export function planQueue({
  ranked,
  owed,
  discovered,
  lastSeen,
  budget,
  ladder,
}: PlanInput): RunPlan {
  /*
   * Three passes, in the order the night should be worked, and every one of
   * them spends from the same budget.
   *
   * The budget used to be applied to the rotation alone, on the assumption that
   * the ranked list was small — the API capped it at 200, so it was. On
   * 2026-08-20 TrustMRR lifted that cap and started returning ~5,000, and the
   * assumption became a queue of 4,999 slugs against a three-hour ceiling: the
   * job was killed nightly at 575, the compute step at the end never ran, the
   * rotation never happened so no new founder was ever discovered, and the
   * claimed sheets sat at position 4,998 where nothing reached them.
   *
   * So nothing here reads a length and trusts it. `take` is the only way into
   * the queue, and it cannot exceed the budget or repeat a slug.
   */
  const queue: string[] = []
  const queued = new Set<string>()

  const take = (candidates: Iterable<string>, upTo: number): string[] => {
    const taken: string[] = []
    for (const slug of candidates) {
      if (taken.length >= upTo || queue.length >= budget) break
      if (queued.has(slug)) continue
      queued.add(slug)
      queue.push(slug)
      taken.push(slug)
    }
    return taken
  }

  // Claimed founders first. Their sheet is the one page somebody actually
  // looks at, and compute judges an accepted quest against whatever tonight
  // collected — an unvisited slug on the day a promise falls due is a verdict
  // on a reading that never arrived.
  const priority = take(owed, budget)

  // Then the ladder, which is the top of the ranked list and not all of it.
  const top = take(ranked, ladder)

  // Then the stalest of everything else: never captured first (no entry → ''
  // → first), then whatever we have not seen in longest. This is the only pass
  // that grows coverage, which is why it gets a reserved share of the budget
  // rather than whatever the other two happen to leave.
  const rotating = take(
    discovered
      .map((slug) => ({ slug, last: lastSeen.get(slug) ?? '' }))
      .sort((a, b) => a.last.localeCompare(b.last))
      .map((r) => r.slug),
    budget,
  )

  return {
    slugs: queue,
    priority,
    ladder: top,
    rotating,
    fresh: rotating.filter((slug) => !lastSeen.has(slug)).length,
  }
}
