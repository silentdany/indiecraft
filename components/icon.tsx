import type { CharacterClass } from '@/engine/types'

/**
 * The icon set, drawn here rather than borrowed.
 *
 * The reference armory carries a glyph on every stat and every class, and that
 * is most of why it reads as a game interface instead of a table. What it is
 * NOT is a source of files: the spec's first design rule is "no Blizzard assets
 * — not a font, not an icon, not a pixel". So the vocabulary is copied and the
 * drawings are not.
 *
 * Multi-element glyphs are wrapped in <g>, never in a React fragment. Satori
 * renders these into the OG image and chokes on a fragment with "cannot convert
 * a Symbol value to a string" — which surfaces as a 500 on some handles and not
 * others, depending purely on whether their class glyph happened to need two
 * shapes.
 *
 * The vocabulary, in three parts:
 *   - line art, never filled shapes, so a glyph reads at 14px and at 40px;
 *   - `currentColor` throughout, so an icon inherits the quality colour of
 *     whatever it sits in and the rarity system extends to it for free;
 *   - a 24px grid with a 1.6 stroke, which is the weight that survives being
 *     shrunk into a ladder row.
 *
 * Every glyph has to earn its meaning from the class rule it stands for, not
 * from fantasy decoration. A Warlock pays for customers, so it is a summoning
 * ring around a flame. A Priest keeps them, so it is a pulse that does not
 * stop. Nothing here is a sword because swords look cool.
 */

type IconName =
  | CharacterClass
  | 'characters'
  | 'level'
  | 'revenue'
  | 'gear'
  | 'achievement'
  | 'crest'
  | 'drop'
  | 'coins'
  | 'bowl'
  | 'crown'
  | 'crowd'
  | 'banner'
  | 'stack'
  | 'shieldPulse'
  | 'rising'
  | 'hourglass'
  | 'lone'
  | 'linked'
  | 'beacon'
  | 'ring'

const PATHS: Record<IconName, React.ReactNode> = {
  // --- Classes -------------------------------------------------------------
  /** A compass: the beginning of a journey, and the class of not-knowing-yet. */
  Adventurer: (
    <g>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15 9l-2 5-5 2 2-5z" />
    </g>
  ),
  /** A spark. Built with whatever just shipped. */
  Mage: <path d="M12 2.5l2 7.5 7.5 2-7.5 2-2 7.5-2-7.5-7.5-2 7.5-2z" />,
  /** A crosshair. Found before they go looking. */
  Hunter: (
    <g>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" />
    </g>
  ),
  /** A summoning ring around a flame: every customer arrives, and is paid for. */
  Warlock: (
    <g>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5c2.5 2 3.5 3.4 3.5 5a3.5 3.5 0 01-7 0c0-1 .4-1.9 1.2-2.8.3 1 .8 1.5 1.5 1.7-.3-1.5-.1-2.8.8-3.9z" />
    </g>
  ),
  /** A sound wave. Their audience is their channel. */
  Bard: <path d="M3 12h2.5M8 6.5v11M12 3.5v17M16 7.5v9M20.5 12H21" />,
  /** A pulse that does not stop. Their customers stay. */
  Priest: <path d="M2 12.5h4.5l2-5 3.5 10 2.5-7 1.8 2h5.7" />,
  /** A ring closed by a single line: paid in full, nothing left to renew. */
  Monk: (
    <g>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6.5 12h11" />
    </g>
  ),
  /** A dagger. Few marks, big scores. */
  Rogue: <path d="M12 2l3 6v7l-3 7-3-7V8zM6.5 10.5h11" />,
  /** Crossed blades. Volume, earned one dollar at a time. */
  Warrior: <path d="M4 3l11 14M20 3L9 17M5.5 16.5l3 3M18.5 16.5l-3 3" />,
  /** A shield. Holds the line. */
  Paladin: <path d="M12 2.5l8 3v6c0 5-4 8.2-8 10-4-1.8-8-5-8-10v-6z" />,

  // --- Readouts ------------------------------------------------------------
  characters: (
    <g>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21c0-4.2 3.4-6.5 7.5-6.5s7.5 2.3 7.5 6.5" />
    </g>
  ),
  level: <path d="M5 14l7-7 7 7M5 20l7-7 7 7" />,
  revenue: (
    <g>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 6.5v11M9 9.5h4.5a2.5 2.5 0 010 5H9" />
    </g>
  ),
  /** The rarity square itself, made into a glyph. */
  gear: (
    <g>
      <rect x="3.5" y="3.5" width="17" height="17" />
      <path d="M8 3.5v3M16 3.5v3M8 17.5v3M16 17.5v3" />
    </g>
  ),
  achievement: (
    <g>
      <path d="M12 2.5l2.6 5.6 6 .8-4.4 4.2 1.1 6.1-5.3-3-5.3 3 1.1-6.1L3.4 8.9l6-.8z" />
    </g>
  ),
  // --- Achievements --------------------------------------------------------
  // One glyph per achievement rather than one star fifteen times over. A wall
  // of identical icons is decoration; a wall of different ones is a set you can
  // scan, which is the only reason the game draws them individually too.
  /** First Blood: the first dollar. */
  drop: <path d="M12 2.5s6 6.9 6 10.9a6 6 0 01-12 0c0-4 6-10.9 6-10.9z" />,
  /** The Thousand: it stacks now. */
  coins: (
    <g>
      <ellipse cx="12" cy="6.5" rx="7.5" ry="3" />
      <path d="M4.5 6.5v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5" />
      <path d="M4.5 11.5v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5" />
    </g>
  ),
  /** Ramen Profitable: the bowl that pays rent. */
  bowl: (
    <g>
      <path d="M3 10.5h18c0 5-4 8.5-9 8.5s-9-3.5-9-8.5z" />
      <path d="M9 7c0-1.5 1.5-1.5 1.5-3M13.5 7c0-1.5 1.5-1.5 1.5-3" />
    </g>
  ),
  /** Raid Boss Slayer: the big one went down. */
  crown: <path d="M3 17.5h18M4 17.5L3 6.5l5 4 4-6 4 6 5-4-1 11" />,
  /** Centurion: a hundred of them. */
  crowd: (
    <g>
      <circle cx="8" cy="8.5" r="3" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M2 19c0-3.3 2.7-5 6-5s6 1.7 6 5M14.5 19c0-2.6 1.9-4 4-4 1.6 0 3.5.9 3.5 3.4" />
    </g>
  ),
  /** Legion: a thousand, and they march. */
  banner: (
    <g>
      <path d="M6 2.5v19" />
      <path d="M6 4h13l-3 4 3 4H6z" />
    </g>
  ),
  /** Multiboxer / Alt King: more than one thing shipped. */
  stack: (
    <g>
      <rect x="3.5" y="14" width="17" height="6.5" />
      <path d="M5.5 11h13M7.5 8h9" />
    </g>
  ),
  /** Unkillable: it holds, and it keeps a pulse. */
  shieldPulse: (
    <g>
      <path d="M12 2.5l7.5 2.8v5.6c0 4.7-3.7 7.7-7.5 9.4-3.8-1.7-7.5-4.7-7.5-9.4V5.3z" />
      <path d="M7.5 11.5h2l1.5-3 2 5.5 1.3-2.5h2.2" />
    </g>
  ),
  /** Ascension: up and to the right, for once literally. */
  rising: (
    <g>
      <path d="M3 18.5l6-6 4 4 8-8" />
      <path d="M15.5 8.5H21v5.5" />
    </g>
  ),
  /** Veteran: two years of it. */
  hourglass: (
    <g>
      <path d="M6 2.5h12M6 21.5h12" />
      <path d="M7.5 2.5v4L12 12l4.5-5.5v-4M7.5 21.5v-4L12 12l4.5 5.5v4" />
    </g>
  ),
  /** Lone Wolf: one node, no edges. */
  lone: (
    <g>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </g>
  ),
  /** Guilded: an edge appears. */
  linked: (
    <g>
      <circle cx="6.5" cy="7" r="3" />
      <circle cx="17.5" cy="17" r="3" />
      <path d="M8.8 9.2l6.4 5.6" />
    </g>
  ),
  /** Authority: something everyone can see from far away. */
  beacon: (
    <g>
      <path d="M9 21.5l1.5-11h3l1.5 11z" />
      <circle cx="12" cy="6.5" r="2.5" />
      <path d="M5.5 3.5L3 2M18.5 3.5L21 2M4 8.5H2M20 8.5h2" />
    </g>
  ),
  /** Ding 60: the ring closes. */
  ring: (
    <g>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
    </g>
  ),

  /** The brand mark: the crest slot the reference fills with a faction sigil. */
  crest: (
    <g>
      <path d="M12 1.5l9.5 5.5v9L12 21.5 2.5 16V7z" />
      <path d="M12 7l4.5 2.6v4.8L12 17l-4.5-2.6V9.6z" />
    </g>
  ),
}

export function Icon({
  name,
  size = 16,
  className,
  style,
  color,
}: {
  name: IconName
  size?: number
  className?: string
  style?: React.CSSProperties
  /** Explicit stroke, for Satori — it does not resolve `currentColor`. */
  color?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={style}
      fill="none"
      stroke={color ?? 'currentColor'}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}

/**
 * Achievement code to glyph. Anything unmapped falls back to the generic star,
 * so adding an achievement in tuning.ts never breaks the sheet — it just looks
 * generic until somebody draws it one.
 */
export const ACHIEVEMENT_ICONS: Record<string, IconName> = {
  first_blood: 'drop',
  the_thousand: 'coins',
  ramen: 'bowl',
  raid_boss: 'crown',
  hundred_customers: 'crowd',
  thousand_customers: 'banner',
  multiboxer: 'stack',
  alt_king: 'stack',
  unkillable: 'shieldPulse',
  ascension: 'rising',
  veteran: 'hourglass',
  lone_wolf: 'lone',
  guilded: 'linked',
  authority: 'beacon',
  ding_sixty: 'ring',
}

export type { IconName }
