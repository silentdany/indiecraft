import type { IconName } from '@/components/icon'
import { WowIcon } from '@/components/wow-icon'
import { type Quest, RARITY_BY_NAME } from '@/engine'
import type { QuestKind } from '@/engine/types'

/**
 * One quest, drawn the same way wherever it appears.
 *
 * It appears twice: as a row in the log under the products, and inside the
 * tooltip that opens when you hover the "!" on an empty slot. Those were built
 * a day apart and drifted immediately — the tooltip had no reward picture, put
 * the reward in a stats table, and stacked its lines in a different order. Two
 * renderings of one object is two things to keep in step by hand, so there is
 * one, and the surfaces only supply the frame around it.
 *
 * No JavaScript: the tooltip half is opened by :hover and :focus-within, and
 * the bars are two elements and a width.
 */

/** What to draw when the CDN does not answer, by what the quest hands over. */
const FALLBACK: Record<QuestKind, IconName> = {
  equip: 'gear',
  upgrade: 'rising',
  achievement: 'achievement',
  level: 'level',
}

export function QuestCard({ quest }: { quest: Quest }) {
  const hex = quest.rewardRarity ? RARITY_BY_NAME.get(quest.rewardRarity)?.hex : undefined

  return (
    <>
      {/*
        The reward, as a quality square. The log was the one place on the site
        that talked about gear without showing any, which made it read as a form
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
}
