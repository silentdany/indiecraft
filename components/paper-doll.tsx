import Link from 'next/link'
import { WowIcon } from '@/components/wow-icon'
import { EMPTY_SLOT_ICONS } from '@/engine'
import type { EquipmentGlyph, EquippedSlot, SlotKey } from '@/engine/types'

/**
 * The paper doll: seventeen slots, one per stat.
 *
 * This is the gesture the sheet was missing. The stat panel already reported
 * every one of these numbers, and reporting is all it did — "domain rating 62"
 * is a fact, "Linkheart Helm, epic" is a thing you are wearing and a thing
 * somebody else is not. Same number, and only one of the two is a game.
 *
 * The arrangement is the reference's own, read off it rather than remembered —
 * see the slot arrays below.
 *
 * No JavaScript, exactly like GearItem. `:hover` opens the tooltip for a mouse
 * and `:focus-within` opens it for a keyboard or a tap.
 */

/*
 * Eight, eight, and three, in the reference's exact order.
 *
 * Taken from the real thing rather than from memory — classic-armory.org ships
 * LEFT_EQUIPMENT_SLOTS / RIGHT_EQUIPMENT_SLOTS / WEAPON_SLOTS in its bundle,
 * and they read: Head, Neck, Shoulder, Back, Chest, Tabard, Shirt, Wrist down
 * the left; Hands, Waist, Legs, Feet, Finger, Finger, Trinket, Trinket down the
 * right; the three weapons underneath.
 *
 * An earlier version moved Hands to the left to balance the columns around the
 * portrait, having dropped Tabard and Shirt for carrying no quality. Both
 * decisions were wrong and they were the same wrong decision: the reference
 * balances with those two, and they are cosmetic THERE too — a tabard has never
 * had an item level. They come back below as cosmetic slots carrying faction
 * and realm, which is the closest honest reading of what they are for.
 */
const LEFT: SlotKey[] = ['head', 'neck', 'shoulders', 'back', 'chest']
const LEFT_TAIL: SlotKey[] = ['wrist']
const RIGHT: SlotKey[] = [
  'hands',
  'waist',
  'legs',
  'feet',
  'ring1',
  'ring2',
  'trinket1',
  'trinket2',
]
const RAIL: SlotKey[] = ['mainHand', 'offHand', 'ranged']

/**
 * Tabard and Shirt: the two slots with no score.
 *
 * Faction and realm, which is what those slots have always been for — a tabard
 * says who you fight for and a shirt is the one piece nobody else can read
 * anything into. Rendered without a quality colour on purpose: giving them one
 * would claim there is a better country to be from.
 */
export interface CosmeticSlot {
  /** Blizzard slug when the thing has a picture — a faction banner does, a country does not. */
  icon: string | null
  label: string
  value: string
  href: string
  glyph: EquipmentGlyph | 'crest' | 'realm' | 'B2B' | 'B2C' | 'Both'
}

/**
 * `children` is the character: portrait, name, level, standing. It renders
 * between the two columns because that is what a paper doll IS — the gear is
 * arranged around a person, and a doll with a gap in the middle is a table.
 */
export function PaperDoll({
  doll,
  questSlots,
  tabard,
  shirt,
  children,
}: {
  doll: EquippedSlot[]
  /**
   * Slots the quest log has something to say about.
   *
   * Passed in rather than inferred from `item === null`, which would be true
   * today and quietly wrong the first time a quest is filtered out: the marker
   * has to promise there is a quest, because clicking it goes to one.
   */
  questSlots?: SlotKey[]
  tabard?: CosmeticSlot | null
  shirt?: CosmeticSlot | null
  children?: React.ReactNode
}) {
  const by = new Map(doll.map((s) => [s.slot, s]))
  const quested = new Set(questSlots ?? [])
  const column = (keys: SlotKey[]) =>
    keys.map((key) => {
      const slot = by.get(key)
      return slot ? <Slot key={key} slot={slot} quest={quested.has(key)} /> : null
    })

  return (
    <div className={children ? 'doll doll-dressed' : 'doll'}>
      <div className="doll-col">
        {column(LEFT)}
        {tabard && <Cosmetic slot={tabard} />}
        {shirt && <Cosmetic slot={shirt} />}
        {column(LEFT_TAIL)}
      </div>
      {children && <div className="doll-center">{children}</div>}
      <div className="doll-col doll-col-right">{column(RIGHT)}</div>
      <div className="doll-rail">{column(RAIL)}</div>
    </div>
  )
}

/** A link, not a div: both of these lead somewhere worth going. */
function Cosmetic({ slot }: { slot: CosmeticSlot }) {
  return (
    <Link href={slot.href} className="doll-slot doll-cosmetic">
      <WowIcon slug={slot.icon} glyph={slot.glyph} size={38} className="doll-icon" />
      <span className="doll-body">
        <span className="doll-name serif">{slot.value}</span>
        <span className="doll-meta label">{slot.label}</span>
      </span>
    </Link>
  )
}

function Slot({ slot, quest }: { slot: EquippedSlot; quest?: boolean }) {
  const { item } = slot

  if (!item) {
    return (
      <div className={`doll-slot doll-empty doll-${slot.empty}${quest ? ' doll-quest' : ''}`}>
        {/* The greyed silhouette of what belongs here. An empty slot that still
            says "helm" is a gap in a character; a blank square is a layout
            artifact, and the two should not look the same. */}
        <WowIcon
          slug={EMPTY_SLOT_ICONS[slot.glyph]}
          glyph={slot.glyph}
          size={38}
          className="doll-icon"
        />
        <span className="doll-body">
          {/*
            "Empty", not "Not reported", and that is a correction rather than a
            rewording.

            The old copy asserted TrustMRR's silence. It cannot: the API sends 0
            rather than null for a field nobody filled in — 96% of listings
            report zero customers, including listings with real MRR — so "not
            reported" was a guess that was wrong about half the time, told to
            the one person who knows better. "Nothing yet" survives because it
            is only used when a real number arrived and sat below the first
            rung, which is a fact we do have.
          */}
          <span className="doll-name doll-nothing">
            {slot.empty === 'unearned' ? 'Nothing yet' : 'Empty'}
          </span>
          <span className="doll-meta label">
            {slot.label} · {slot.stat}
          </span>
        </span>
        {/*
          The quest marker, and it is the reference's own gesture rather than a
          badge invented for this grid: in the game the yellow "!" hangs over
          the thing you can go and do, it does not move, and you walk to it. An
          empty slot with something available in it is exactly that. Drawn in
          CSS on the tile, never as a toast — a toast is transient and the log
          is a list you come back to.

          Last child and a flex item rather than an overlay: these tiles hold a
          stat name that wraps, and an absolutely positioned marker sat on top
          of it at the narrow end of the grid.
        */}
        {quest && (
          <span className="doll-bang" aria-hidden="true">
            !
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="doll-slot" style={{ color: item.rarity.hex }}>
      <WowIcon slug={item.icon} glyph={slot.glyph} size={38} className="doll-icon" />

      <span className="doll-body">
        <span className="doll-name serif">{item.name}</span>
        <span className="doll-meta label">
          {slot.stat} <b>{item.valueLabel}</b>
          {/* The piece's own item level, which is what the character's averages.
              Without it the header figure is a number with no visible source.

              The separator is here rather than in a CSS `::before`: generated
              content is announced inconsistently, and without it a screen
              reader runs the two numbers together into "domain rating 71 58". */}
          <span className="doll-ilvl"> · {item.itemLevel}</span>
        </span>
      </span>

      <div className="tooltip" role="tooltip">
        <div className="tooltip-name serif" style={{ color: item.rarity.hex }}>
          {item.name}
        </div>
        <div className="tooltip-sub">
          Item level {item.itemLevel} · {slot.label}
        </div>

        <div className="tooltip-stats">
          <div className="tooltip-stat">
            <span>{slot.stat}</span>
            <span className="tooltip-stat-v">{item.valueLabel}</span>
          </div>
        </div>

        {/*
          The upgrade line is what separates a readout from a goal. "Domain
          rating 62" ends the conversation; "70 for Crown of Distribution" is
          the next thing to go and do, priced in the slot's own units.
        */}
        {item.next ? (
          <div className="tooltip-req">
            <span style={{ color: item.next.rarity.hex }}>{item.next.name}</span> at{' '}
            {item.next.minLabel}
          </div>
        ) : (
          <div className="tooltip-req">Best in slot.</div>
        )}
      </div>
    </div>
  )
}
