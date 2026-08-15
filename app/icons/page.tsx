import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { WowIcon } from '@/components/wow-icon'
import { RARITY_BY_NAME } from '@/engine'
import { type CensusSection, type IconEntry, iconCensus } from '@/lib/icon-census'
import { wowIconUrl } from '@/lib/wow-icon'

export const metadata: Metadata = {
  title: 'Icon census',
  robots: { index: false, follow: false },
}

/**
 * Every borrowed picture on the site, next to the item it is supposed to be.
 *
 * `pnpm verify-icons` already proves all 283 slugs RESOLVE. It cannot prove any
 * of them is the RIGHT picture: `inv_helmet_25` returns bytes whether or not it
 * is the Lionheart Helm the name promises, so a plausible-looking wrong slug
 * passes every gate in this repo and lands on somebody's paper doll. The only
 * instrument that catches that is a pair of eyes, and this page is what it
 * takes to use them on 283 squares in one sitting rather than 283.
 *
 * Three things make it a review tool rather than a gallery:
 *
 *  - grouped by ladder, common first, so the check is RELATIVE. A legendary
 *    that looks scruffier than the rare below it is obvious in a five-rung
 *    column and invisible in a wall of squares.
 *  - variants sit beside the base they vary, because the mistake they invite is
 *    a mail legguard that is plainly a cloth robe.
 *  - the source item is a Wowhead link. The question is never "is this a nice
 *    icon", it is "is this the icon Arcanite Reaper actually has", and that is
 *    one click away rather than a search and a lost place in the list.
 *
 * ---------------------------------------------------------------------------
 * Dev-only, deliberately.
 *
 * The rule this repo relaxed was about USING Blizzard icons in context — a
 * founder's helm slot showing a helm. A public page whose entire content is 283
 * Blizzard icons in a grid is a different posture: that is a catalogue, and it
 * is not what the exception was for. It costs nothing to keep it local, since
 * the person reviewing the icons is the person running the dev server.
 *
 * One line below is all that stands in the way if it ever needs to deploy.
 * ---------------------------------------------------------------------------
 */
export default function Icons() {
  if (process.env.NODE_ENV === 'production') notFound()

  const sections = iconCensus()
  const total = sections.reduce((sum, s) => sum + s.entries.length, 0)

  return (
    <main className="page">
      <header className="page-head">
        <h1 className="serif gold">ICON CENSUS</h1>
        <p className="muted">
          All {total} borrowed pictures, grouped the way they are worn. Every slug here resolves —
          that much <code>pnpm verify-icons</code> already guarantees. What is left to check is
          whether each one is the picture its name promises, which is a question only looking at
          them answers. The grey text under each is the real item it derives from; follow it to
          Wowhead to compare.
        </p>
      </header>

      {sections.map((section) => (
        <Section key={section.key} section={section} />
      ))}
    </main>
  )
}

function Section({ section }: { section: CensusSection }) {
  // Items group into rungs; everything else is one flat strip. Same markup,
  // different number of groups — a class list is a ladder with a single rung.
  const rungs: IconEntry[][] = []
  if (section.group === 'item') {
    const byTier = new Map<string, IconEntry[]>()
    for (const entry of section.entries) {
      const rung = byTier.get(entry.tier)
      if (rung) rung.push(entry)
      else byTier.set(entry.tier, [entry])
    }
    rungs.push(...byTier.values())
  } else {
    rungs.push(section.entries)
  }

  return (
    <section className="sheet-section">
      <h2 className="serif">
        {section.title} <span className="census-count">{section.entries.length}</span>
      </h2>
      <div className="census-rungs">
        {rungs.map((entries) => (
          <div className="census-rung" key={entries[0]?.tier}>
            {entries.map((entry) => (
              <Cell entry={entry} key={`${entry.slot}:${entry.icon}:${entry.name}`} />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

function Cell({ entry }: { entry: IconEntry }) {
  const hex = entry.rarity ? RARITY_BY_NAME.get(entry.rarity)?.hex : undefined
  // Only the armour/weapon axis, not the slot key: "plate" is the fact worth
  // reading here, and "legs/plate" repeats a heading three lines above.
  const variant = entry.slot.split('/')[1]

  return (
    <figure className="census-cell">
      <WowIcon slug={entry.icon} glyph={entry.glyph} size={48} color={hex} />
      <figcaption>
        <span className="census-name" style={{ color: hex }}>
          {entry.name}
          {variant && <span className="census-variant">{variant}</span>}
        </span>
        <a
          className="census-after"
          href={`https://www.wowhead.com/classic/search?q=${encodeURIComponent(entry.after)}`}
          rel="noreferrer"
          target="_blank"
        >
          {entry.after}
        </a>
        {/* The slug is the thing you come here to correct, so it is selectable
            text and a link to the raw file rather than a tooltip. */}
        <a className="census-slug" href={wowIconUrl(entry.icon)} rel="noreferrer" target="_blank">
          {entry.icon}
        </a>
      </figcaption>
    </figure>
  )
}
