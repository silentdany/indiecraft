import type { IconName } from '@/components/icon'
import { WowIcon } from '@/components/wow-icon'
import { type Quest, RARITY_BY_NAME } from '@/engine'
import type { QuestKind } from '@/engine/types'

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
 *
 * No JavaScript anywhere in here — same commitment as the tooltips and the
 * tabs. The bars are two divs and a width.
 */

/** What to draw when the CDN does not answer, by what the quest hands over. */
const FALLBACK: Record<QuestKind, IconName> = {
  equip: 'gear',
  upgrade: 'rising',
  achievement: 'achievement',
  level: 'level',
}

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
          <QuestRow key={quest.code} quest={quest} />
        ))}
      </ol>
    </section>
  )
}

function QuestRow({ quest }: { quest: Quest }) {
  const hex = quest.rewardRarity ? RARITY_BY_NAME.get(quest.rewardRarity)?.hex : undefined

  const body = (
    <>
      {/*
        The reward, as a quality square. This was the one place on the site that
        talked about gear without showing any, which made the log read as a form
        rather than as part of the armory — and the colour says what "(common)"
        used to say in parentheses, so the name gets to be just a name.
      */}
      <WowIcon
        slug={quest.rewardIcon}
        glyph={FALLBACK[quest.kind]}
        size={44}
        color={hex}
        className="quest-icon"
      />
      <span className="quest-body">
        <span className="quest-head">
          <span className="quest-title serif">{quest.title}</span>
          {quest.progress && (
            <span className="quest-pct label">{Math.round(quest.progress.ratio * 100)}%</span>
          )}
        </span>
        <span className="quest-need muted">
          {quest.requirement} <span className="quest-arrow">→</span>{' '}
          <span className="quest-reward" style={{ color: hex }}>
            {quest.reward}
          </span>
        </span>
        {/*
          The instruction, which is the part that was missing before anybody
          could act on this. A condition is not a quest: "Followers of 1" says
          when the slot fills and nothing about where a follower count is
          entered.
        */}
        <span className="quest-do">
          {quest.action}
          {quest.href && <span className="quest-out"> ↗</span>}
        </span>
        {/*
          A bar only where there is a distance to draw. An equip quest has no
          "current" — the stat has no usable value — and a bar from zero would
          state the founder is at zero, which is the one claim this corpus
          cannot support.
        */}
        {quest.progress && (
          <span className="quest-bar">
            <span
              className="quest-bar-fill"
              style={{ width: `${Math.max(quest.progress.ratio * 100, 1.5)}%` }}
            />
          </span>
        )}
      </span>
    </>
  )

  return (
    <li className={`quest quest-${quest.kind}`}>
      {quest.href ? (
        <a className="quest-row" href={quest.href} rel="noreferrer" target="_blank">
          {body}
        </a>
      ) : (
        <span className="quest-row">{body}</span>
      )}
    </li>
  )
}
