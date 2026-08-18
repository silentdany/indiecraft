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
    </section>
  )
}
