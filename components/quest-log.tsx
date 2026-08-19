import { QuestCard } from '@/components/quest-card'
import type { Quest, QuestDone } from '@/engine'

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
 * Every row is a link, not a panel with a button under it. The instruction and
 * the place it happens are one gesture, and a footer CTA made three quests
 * share one destination that only the last of them appeared to own.
 */
export function QuestLog({ quests, done }: { quests: Quest[]; done: QuestDone[] }) {
  if (quests.length === 0 && done.length === 0) return null

  return (
    <section className="sheet-section">
      <h2 className="serif">
        <span className="quest-bang" aria-hidden="true">
          !
        </span>
        QUEST LOG
      </h2>
      {/*
        What already finished, and the only line on this sheet that is different
        on a second visit. Everything else is a photograph — the same numbers
        and the same advice until a threshold moves.
      */}
      {done.length > 0 && (
        <ul className="quests-done">
          {done.map((d) => (
            <li className="quest-done" key={d.code}>
              <span className="quest-done-tick" aria-hidden="true">
                ✓
              </span>
              {d.line}
              <span className="quest-done-on label">{d.on}</span>
            </li>
          ))}
        </ul>
      )}
      <ol className="quests">
        {quests.map((quest) => (
          <li className={`quest quest-${quest.kind}`} key={quest.code}>
            {quest.href ? (
              <a className="quest-row" href={quest.href} rel="noreferrer" target="_blank">
                <QuestCard quest={quest} />
              </a>
            ) : (
              <span className="quest-row">
                <QuestCard quest={quest} />
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
