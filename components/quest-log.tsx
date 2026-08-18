import type { Quest } from '@/engine'

/**
 * The quest log: the three things worth doing next, in order.
 *
 * The sheet already held every one of these numbers and printed them in four
 * places that never spoke — the next rung of a worn item, the first rung of an
 * empty one, a locked badge's distance, the XP left in a level. A founder could
 * read all four panels and still not know which single thing to go and do. This
 * is the same data, sorted.
 *
 * Public rather than owner-only, and that is a decision. The obvious instinct
 * is to hide it behind the sign-in, and it would have been wrong twice over:
 * one founder in 3,900 has ever signed in, so nobody would see it, and a
 * stranger reading "three customers from a rare chestpiece" understands the
 * whole product in one line. The quest log is the best explanation of the game
 * the site has.
 *
 * No JavaScript anywhere in here — same commitment as the tooltips and the
 * tabs. The bars are two divs and a width.
 */
export function QuestLog({ quests }: { quests: Quest[] }) {
  if (quests.length === 0) return null
  const link = quests.find((q) => q.href)?.href ?? null
  /*
   * When every quest asks for the same thing — which is the whole reporting
   * phase, where all three are "set it on your listing" — say it once at the
   * foot instead of three times in a column. Three identical gold lines read as
   * a stutter, and the eye stops seeing the one that matters.
   */
  const shared = quests.every((q) => q.action === quests[0]?.action) ? quests[0]?.action : null

  return (
    <section className="sheet-section">
      <h2 className="serif">
        <span className="quest-bang" aria-hidden="true">
          !
        </span>
        QUEST LOG
      </h2>
      <ol className="quests">
        {quests.map((quest) => (
          <li className={`quest quest-${quest.kind}`} key={quest.code}>
            <div className="quest-head">
              <span className="quest-title serif">{quest.title}</span>
              {quest.progress && (
                <span className="quest-pct label">{Math.round(quest.progress.ratio * 100)}%</span>
              )}
            </div>
            <p className="quest-need muted">
              {quest.requirement} <span className="quest-arrow">→</span>{' '}
              <span className="quest-reward">{quest.reward}</span>
            </p>
            {/*
              The instruction, which is the part that was missing. A condition
              is not a quest: "Followers of 1" says when the slot fills and
              nothing about where a follower count is entered.
            */}
            {!shared && <p className="quest-do">{quest.action}</p>}
            {/*
              A bar only where there is a distance to draw. An equip quest has
              no "current" — the stat has no usable value — and a bar from zero
              would state the founder is at zero, which is the one claim this
              corpus cannot support.
            */}
            {quest.progress && (
              <div className="quest-bar">
                <div
                  className="quest-bar-fill"
                  style={{ width: `${Math.max(quest.progress.ratio * 100, 1.5)}%` }}
                />
              </div>
            )}
          </li>
        ))}
      </ol>
      {/*
        One link for the panel rather than one per row: every quest here ends at
        the same page, and three identical buttons would read as three different
        destinations.
      */}
      <div className="quest-foot">
        {shared && <p className="quest-do">{shared}</p>}
        {link && (
          <a className="quest-cta share-x" href={link} rel="noreferrer" target="_blank">
            Open your TrustMRR listing
          </a>
        )}
      </div>
    </section>
  )
}
