import { describe, expect, it } from 'vitest'
import { equipmentFor, equipmentInput, equipmentScore, scoreOnSlot } from './equipment'
import { CLASS_GEAR, RARITY_BY_NAME, SLOTS, SLOTS_BY_KEY } from './tuning'
import type {
  CharacterClass,
  EquipmentInput,
  EquippedSlot,
  RarityName,
  SlotKey,
  WeaponFamily,
} from './types'

const RARITY_ORDER: readonly RarityName[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']

function input(overrides: Partial<EquipmentInput> = {}): EquipmentInput {
  const base: EquipmentInput = {
    handle: 'test',
    revenueTotalUsd: 0,
    mrrUsd: 0,
    customers: 0,
    activeSubscriptions: 0,
    nProducts: 0,
    retention: 0,
    hasRetentionSignal: false,
    effectiveCustomers: 0,
    growthMrr30d: 0,
    domainRating: null,
    foundedFirst: null,
    channels: [],
    stack: [],
    cofounders: [],
    fundingStatuses: [],
    visitors30d: 0,
    categories: [],
    hasMobileApp: false,
    profitMargin30d: null,
    googleImpressions30d: 0,
    everListedForSale: false,
    allProductsEarning: false,
    realm: null,
    faction: null,
    followers: null,
    characterClass: 'Adventurer',
    ...overrides,
  }
  // Mirrors aggregateFounder, so a test that sets `customers` gets a coherent
  // input rather than a hand-assembled impossible one — a founder with 400
  // customers and a retention of 0 is not a shape the crawler can produce.
  return {
    ...base,
    hasRetentionSignal: overrides.hasRetentionSignal ?? base.customers > 0,
    effectiveCustomers:
      overrides.effectiveCustomers ??
      (base.customers > 0 ? base.customers : base.activeSubscriptions),
    retention:
      overrides.retention ??
      (base.customers > 0 ? Math.min(base.activeSubscriptions / base.customers, 1) : 0),
  }
}

const at = (slots: EquippedSlot[], key: SlotKey): EquippedSlot => {
  const found = slots.find((s) => s.slot === key)
  if (!found) throw new Error(`no slot ${key}`)
  return found
}

/**
 * The table itself, checked before anything that reads it.
 *
 * These are the invariants `equipmentFor` assumes and never verifies at
 * runtime: it walks `items` in source order and stops at the first floor the
 * value misses, so an out-of-order table would silently hand out the wrong
 * item rather than throwing.
 */
describe('the equipment table', () => {
  it('covers seventeen slots, each one distinct', () => {
    expect(SLOTS).toHaveLength(17)
    expect(new Set(SLOTS.map((s) => s.key)).size).toBe(17)
    expect(SLOTS_BY_KEY.size).toBe(17)
  })

  it.each(SLOTS.map((s) => [s.key, s] as const))(
    '%s carries five items, ascending in floor and in quality',
    (_key, slot) => {
      expect(slot.items).toHaveLength(5)

      const floors = slot.items.map((i) => i.min)
      expect(floors).toEqual([...floors].sort((a, b) => a - b))

      expect(slot.items.map((i) => i.rarity)).toEqual(RARITY_ORDER)
    },
  )

  it('names every item exactly once across the whole doll', () => {
    const names = SLOTS.flatMap((s) => s.items.map((i) => i.name))
    expect(names).toHaveLength(85)
    expect(new Set(names).size).toBe(85)
  })

  /**
   * The derivation rule, enforced as far as a test can enforce a joke: an item
   * whose name is identical to the Classic one it claims to derive from has not
   * been derived, it has been copied.
   */
  it('derives every name rather than copying one', () => {
    for (const slot of SLOTS) {
      for (const item of slot.items) {
        expect(item.after, `${slot.key} / ${item.name}`).not.toBe(item.name)
        expect(item.after.length).toBeGreaterThan(0)
      }
    }
  })

  /**
   * Shape only. Whether a slug actually resolves is a network question and
   * belongs to `pnpm verify-icons` — the suite has to pass offline, and a red
   * build because Blizzard's CDN blinked would teach everyone to ignore it.
   */
  it('gives every item an icon slug', () => {
    for (const slot of SLOTS) {
      for (const item of slot.items) {
        expect(item.icon, `${slot.key} / ${item.name}`).toMatch(/^[a-z0-9_]+$/)
      }
    }
  })

  it('resolves every quality to a colour in the shared palette', () => {
    for (const slot of SLOTS) {
      for (const item of slot.items) {
        expect(RARITY_BY_NAME.get(item.rarity)).toBeDefined()
      }
    }
  })
})

describe('equipmentFor', () => {
  it('always returns every slot, in table order', () => {
    const slots = equipmentFor(input())
    expect(slots).toHaveLength(17)
    expect(slots.map((s) => s.slot)).toEqual(SLOTS.map((s) => s.key))
  })

  it('picks the highest item whose floor the stat clears', () => {
    // $10,000 MRR is the epic floor exactly; $9,999 is still the rare below it.
    // A Warrior swings an axe, which is what makes this one the Reaper.
    const warrior = { characterClass: 'Warrior' as const }
    expect(at(equipmentFor(input({ ...warrior, mrrUsd: 10_000 })), 'mainHand').item?.name).toBe(
      'Arcanite Revenuer',
    )
    expect(at(equipmentFor(input({ ...warrior, mrrUsd: 9_999 })), 'mainHand').item?.name).toBe(
      'Ravager of Retainers',
    )
    expect(at(equipmentFor(input({ mrrUsd: 250_000 })), 'mainHand').item?.rarity.name).toBe(
      'legendary',
    )
  })

  it('reports the stat in the slot units, and what the next rung costs', () => {
    const main = at(
      equipmentFor(input({ characterClass: 'Warrior', mrrUsd: 1_500 })),
      'mainHand',
    ).item
    expect(main?.valueLabel).toBe('$1,500')
    // The upgrade is named as THIS class will wear it, not as the base entry.
    expect(main?.next).toMatchObject({ name: 'Arcanite Revenuer', min: 10_000 })
    expect(main?.next?.minLabel).toBe('$10K')
  })

  it('offers no upgrade at the top of a ladder', () => {
    expect(at(equipmentFor(input({ mrrUsd: 5_000_000 })), 'mainHand').item?.next).toBeNull()
  })
})

/**
 * The distinction the whole engine is built around, applied to gear: a blank
 * TrustMRR field is not a bad score. Every one of these would otherwise dress a
 * founder in grey for a question nobody asked them.
 */
describe('empty slots', () => {
  it('leaves a slot unreported when the corpus never answered', () => {
    const slots = equipmentFor(input())
    for (const key of ['head', 'neck', 'waist', 'legs', 'ranged', 'trinket2'] as SlotKey[]) {
      expect(at(slots, key), key).toMatchObject({ item: null, empty: 'unreported' })
    }
  })

  it('never penalises a missing retention signal', () => {
    // activeSubscriptions without customers is the commonest shape in the
    // corpus, and it must not read as a founder whose customers all left.
    const thin = equipmentFor(input({ activeSubscriptions: 40, mrrUsd: 900 }))
    expect(at(thin, 'back')).toMatchObject({ item: null, empty: 'unreported' })
    // The same founder is still dressed everywhere the data does exist, and
    // dressed off activeSubscriptions rather than off the customers TrustMRR
    // never filled in.
    expect(at(thin, 'chest').item?.name).toBe('Robe of the Early Adopter')
    expect(at(thin, 'mainHand').item).not.toBeNull()
  })

  it('separates "not yet" from "never told"', () => {
    // A reported domain rating of 0 is a real measurement below the first rung.
    expect(at(equipmentFor(input({ domainRating: 0 })), 'head')).toMatchObject({
      item: null,
      empty: 'unearned',
    })
    expect(at(equipmentFor(input({ domainRating: null })), 'head')).toMatchObject({
      item: null,
      empty: 'unreported',
    })
  })

  it('gives the solo founder a real ring rather than a hole', () => {
    // 98.7% of the corpus builds alone. Rendering the normal case as an empty
    // slot would tell almost everybody they are missing something.
    const solo = at(equipmentFor(input()), 'ring2')
    expect(solo.item?.name).toBe("Plain Founder's Band")
    expect(solo.empty).toBeNull()
  })

  it('reads a flat month as growth and no revenue as silence', () => {
    expect(at(equipmentFor(input({ mrrUsd: 500, growthMrr30d: 0 })), 'feet').item?.name).toBe(
      // Adventurer wears cloth, so the starting boots are slippers.
      'Worn Bootstrap Slippers',
    )
    expect(at(equipmentFor(input({ mrrUsd: 0, growthMrr30d: 0 })), 'feet')).toMatchObject({
      item: null,
      empty: 'unreported',
    })
  })

  it('drops a slot rather than dividing by no customers', () => {
    expect(at(equipmentFor(input({ mrrUsd: 4_000 })), 'wrist')).toMatchObject({
      item: null,
      empty: 'unreported',
    })
    expect(
      at(equipmentFor(input({ mrrUsd: 4_000, activeSubscriptions: 10 })), 'wrist').item?.valueLabel,
    ).toBe('$400')
  })
})

/**
 * A Mage does not wear plate and a Priest does not carry an axe. This is the
 * oldest rule the reference has and the first one a player notices being
 * broken, which is why it gets its own block rather than a line in another.
 */
describe('class variants', () => {
  const CLASSES = Object.keys(CLASS_GEAR) as CharacterClass[]

  it('arms every class from its own weapon family', () => {
    const wielded = new Map(
      CLASSES.map((c) => [
        c,
        at(equipmentFor(input({ characterClass: c, mrrUsd: 200_000 })), 'mainHand').item?.name,
      ]),
    )
    expect(wielded.get('Warrior')).toBe('Growthhowl')
    expect(wielded.get('Paladin')).toBe('Sulfuras, Hand of the Roadmap')
    expect(wielded.get('Mage')).toBe('Atiesh, Greatstaff of the Guild')
    expect(wielded.get('Rogue')).toBe('Cashfall')
    expect(wielded.get('Monk')).toBe('Shipfury, Blessed Fists of the Bootstrapper')
    // Eleven classes, and no two of them holding the same legendary would be
    // the whole feature failing quietly.
    expect(new Set(wielded.values()).size).toBeGreaterThan(4)
  })

  it('dresses every class in its own armour', () => {
    const chest = (c: CharacterClass) =>
      at(
        equipmentFor(input({ characterClass: c, customers: 700, activeSubscriptions: 700 })),
        'chest',
      ).item?.name
    expect(chest('Mage')).toBe('Robes of the Paid Tier')
    expect(chest('Rogue')).toBe('Vest of the Paid Tier')
    expect(chest('Shaman')).toBe('Mail of the Paid Tier')
    expect(chest('Warrior')).toBe('Breastplate of the Paid Tier')
  })

  it('keeps the ladder identical — only the picture and the noun move', () => {
    // Same MRR, same rung, same colour for everyone. A Mage is not behind a
    // Warrior because they hold a staff.
    const rarities = CLASSES.map(
      (c) =>
        at(equipmentFor(input({ characterClass: c, mrrUsd: 12_000 })), 'mainHand').item?.rarity
          .name,
    )
    expect(new Set(rarities)).toEqual(new Set(['epic']))

    const icons = CLASSES.map(
      (c) => at(equipmentFor(input({ characterClass: c, mrrUsd: 12_000 })), 'mainHand').item?.icon,
    )
    expect(new Set(icons).size).toBeGreaterThan(3)
  })

  it('falls back to the base item where a slot does not vary', () => {
    // A ring is a ring. Every class gets the same one, and that is correct.
    const rings = CLASSES.map(
      (c) => at(equipmentFor(input({ characterClass: c })), 'ring2').item?.name,
    )
    expect(new Set(rings)).toEqual(new Set(["Plain Founder's Band"]))
  })

  /**
   * The proficiency table, as the game states it, asserted against what the
   * doll actually hands out.
   *
   * This exists because the off hand was keyed on armour type — heavy armour
   * means a shield, which sounds right and is false. Hunters wear mail and
   * cannot equip a shield in any version of the game; neither can Evokers, who
   * also wear mail. Shield proficiency does not follow armour class in either
   * direction: Shamans wear mail and can, Rogues wear leather and cannot,
   * Priests wear cloth and can.
   *
   * Written as data rather than as prose in a comment so the next person to add
   * a class or move a slot to a new axis gets a failing test instead of a
   * character holding something they could never pick up.
   */
  const CAN_SHIELD: Record<CharacterClass, boolean> = {
    Warrior: true,
    Paladin: true,
    Shaman: true,
    // Mail, and still no shield — the case that made this test necessary.
    Hunter: false,
    Evoker: false,
    Rogue: false,
    Monk: false,
    Mage: false,
    Warlock: false,
    // True in the reference, but a caster's off hand is a tome here.
    Priest: true,
    // Not a class. The starting kit, which is a sword and a buckler.
    Adventurer: true,
  }

  /** Every weapon family each class may actually wield. */
  const CAN_WIELD: Record<CharacterClass, WeaponFamily[]> = {
    Warrior: ['sword', 'axe', 'hammer', 'mace', 'dagger', 'staff', 'fist'],
    Paladin: ['sword', 'axe', 'hammer', 'mace'],
    Hunter: ['sword', 'axe', 'mace', 'hammer', 'dagger', 'staff', 'fist'],
    Shaman: ['mace', 'hammer', 'axe', 'dagger', 'staff', 'fist'],
    Evoker: ['dagger', 'staff', 'sword', 'axe', 'mace', 'hammer', 'fist'],
    Rogue: ['dagger', 'sword', 'mace', 'hammer', 'axe', 'fist'],
    Monk: ['fist', 'sword', 'axe', 'mace', 'hammer', 'staff', 'dagger'],
    Mage: ['dagger', 'staff', 'sword'],
    Warlock: ['dagger', 'staff', 'sword'],
    Priest: ['mace', 'hammer', 'dagger', 'staff'],
    Adventurer: ['sword', 'dagger', 'staff', 'mace', 'hammer', 'axe', 'fist'],
  }

  it('never arms a class with a weapon it cannot wield', () => {
    for (const [cls, gear] of Object.entries(CLASS_GEAR) as [
      CharacterClass,
      (typeof CLASS_GEAR)[CharacterClass],
    ][]) {
      expect(CAN_WIELD[cls], `${cls} wielding a ${gear.weapon}`).toContain(gear.weapon)
    }
  })

  it('never hands a shield to a class that cannot hold one', () => {
    for (const [cls, gear] of Object.entries(CLASS_GEAR) as [
      CharacterClass,
      (typeof CLASS_GEAR)[CharacterClass],
    ][]) {
      if (gear.offHand === 'shield') {
        expect(CAN_SHIELD[cls], `${cls} holding a shield`).toBe(true)
      }
    }
  })

  it('gives every variant a slug and a real derivation', () => {
    for (const slot of SLOTS) {
      for (const item of slot.items) {
        for (const [key, variant] of Object.entries(item.variants ?? {})) {
          const where = `${slot.key} / ${item.name} / ${key}`
          expect(variant.icon, where).toMatch(/^[a-z0-9_]+$/)
          expect(variant.name.length, where).toBeGreaterThan(0)
          expect(variant.after.length, where).toBeGreaterThan(0)
        }
      }
    }
  })

  it('only carries variants on slots that declare an axis', () => {
    for (const slot of SLOTS) {
      if (slot.varyBy) continue
      for (const item of slot.items) {
        // A variant on an axis-less slot is dead content: `wearAs` never reads
        // it, so it would sit in the table looking like it worked.
        expect(item.variants, `${slot.key} / ${item.name}`).toBeUndefined()
      }
    }
  })
})

/**
 * Products are gear in the older sense — they never enter the doll, but the
 * sheet still gives them an item level, on the same page as the character's.
 * Two numbers with one name have to come from one place.
 */
describe('scoreOnSlot', () => {
  it('puts a product on the same scale as the gear beside it', () => {
    // $30K of product MRR and $30K of founder MRR are the same fact, so they
    // must score identically. They did not: the product used the pre-doll
    // formula and the level bands, the weapon used the ladder.
    const asProduct = scoreOnSlot('mainHand', 30_000)
    const asWeapon = at(equipmentFor(input({ mrrUsd: 30_000 })), 'mainHand').item
    expect(asProduct?.itemLevel).toBe(asWeapon?.itemLevel)
    expect(asProduct?.rarity.name).toBe(asWeapon?.rarity.name)
  })

  it('rises with the number and stays inside the scale', () => {
    const small = scoreOnSlot('mainHand', 200)
    const large = scoreOnSlot('mainHand', 200_000)
    expect(small?.itemLevel).toBeLessThan(large?.itemLevel ?? 0)
    expect(large?.itemLevel).toBeLessThanOrEqual(60)
  })

  it('scores nothing below the first rung', () => {
    // A product that does not bill monthly has no monthly score, which is the
    // same answer the doll gives an unearned slot.
    expect(scoreOnSlot('mainHand', 0)).toBeNull()
  })

  it('is null for a slot that does not exist', () => {
    expect(scoreOnSlot('nope' as SlotKey, 100)).toBeNull()
  })
})

describe('equipmentScore', () => {
  it('counts an unreported slot against the total, like an unearned one', () => {
    // A founder the corpus says nothing about wears exactly one thing: the
    // plain band that means they build alone.
    expect(equipmentScore(equipmentFor(input()))).toEqual({ worn: 1, total: 17 })
  })

  it('fills the doll for a founder the corpus answered on', () => {
    const complete = equipmentFor(
      input({
        revenueTotalUsd: 500_000,
        mrrUsd: 30_000,
        customers: 400,
        activeSubscriptions: 380,
        nProducts: 3,
        growthMrr30d: 25,
        domainRating: 62,
        foundedFirst: '2019-01-01',
        channels: ['seo', 'twitter', 'newsletter'],
        stack: ['nextjs', 'stripe', 'postgresql', 'vercel', 'react', 'typescript'],
        cofounders: ['someone'],
        visitors30d: 40_000,
        categories: ['Artificial Intelligence', 'Marketing'],
        profitMargin30d: 88,
        googleImpressions30d: 120_000,
        followers: 12_000,
      }),
    )
    expect(equipmentScore(complete)).toEqual({ worn: 17, total: 17 })
    expect(complete.every((s) => s.empty === null)).toBe(true)
  })
})

describe('equipmentInput', () => {
  it('carries a missing follower count through as missing', () => {
    const built = equipmentInput(input({ mrrUsd: 10 }), 'Adventurer')
    expect(built.followers).toBeNull()
    expect(at(equipmentFor(built), 'neck')).toMatchObject({ empty: 'unreported' })
  })

  it('takes the class from the caller rather than re-deriving it', () => {
    expect(equipmentInput(input(), 'Mage').characterClass).toBe('Mage')
  })
})
