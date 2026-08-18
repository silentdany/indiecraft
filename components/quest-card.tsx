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
        The reward, captioned.
        
        It was a bare square before, and a picture with no label is a decoration
        — nobody could tell whether it stood for the slot, the stat or the prize.
        The word under it is small enough to ignore once you have learnt it and
        decisive the first time.
      */}
      <span className="quest-gift">
        <WowIcon
          slug={quest.rewardIcon}
          glyph={FALLBACK[quest.kind]}
          size={44}
          color={hex}
          className="quest-icon"
        />
        <span className="quest-tag label">Reward</span>
      </span>

      <span className="quest-body">
        <span className="quest-head">
          <span className="quest-title serif">{quest.title}</span>
          {quest.progress && (
            <span className="quest-pct label">{Math.round(quest.progress.ratio * 100)}%</span>
          )}
        </span>

        {/*
          Reward and requirement on their own lines, each named. They used to
          share one line joined by an arrow, which read as a single sentence
          about neither and repeated what the icon was already showing.
        */}
        <span className="quest-reward" style={{ color: hex }}>
          {quest.reward}
        </span>
        <span className="quest-need">
          <span className="quest-key label">Requires</span> {quest.requirement}
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
      </span>
    </>
  )
}
