'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { WowIcon } from '@/components/wow-icon'
import { CLASS_COLORS, CLASS_ICONS } from '@/engine'
import type { PickerFounder } from '@/lib/queries'

/**
 * Pick two founders.
 *
 * Comparing existed before this and was reachable from exactly two places: the
 * founder directly above you on the ladder, and the one directly below. Which
 * is the one comparison somebody has already seen the numbers for. Everyone
 * else on the ladder — the person you actually want to measure against — was
 * unreachable without hand-editing a URL.
 *
 * Matching happens on the server. The first version shipped the whole corpus to
 * the browser and filtered locally, which was right at 142 founders and wrong
 * the moment the crawler could see the rest of TrustMRR: hundreds of kilobytes
 * sent to every visitor so that eight rows could be drawn.
 *
 * Rows look like ladder rows on purpose: this is the same population, sorted
 * the same way, and a second visual language for it would be a second thing to
 * learn.
 */
export function ComparePicker({
  initial,
  initialA,
  initialB,
}: {
  /** The strongest few, rendered on the server so the page is never empty. */
  initial: PickerFounder[]
  initialA?: PickerFounder
  initialB?: PickerFounder
}) {
  const router = useRouter()
  const [a, setA] = useState<PickerFounder | null>(initialA ?? null)
  const [b, setB] = useState<PickerFounder | null>(initialB ?? null)

  const ready = a !== null && b !== null && a.handle !== b.handle

  return (
    <div className="picker">
      <div className="picker-slots">
        <Slot
          label="First"
          initial={initial}
          selected={a}
          other={b}
          onPick={setA}
          onClear={() => setA(null)}
        />
        <div className="picker-vs serif">VS</div>
        <Slot
          label="Second"
          initial={initial}
          selected={b}
          other={a}
          onPick={setB}
          onClear={() => setB(null)}
        />
      </div>

      <div className="picker-go">
        <button
          type="button"
          className="share-x"
          disabled={!ready}
          onClick={() => ready && router.push(`/c/${a.handle}/vs/${b.handle}`)}
        >
          Compare
        </button>
        {!ready && <span className="muted">Pick two founders.</span>}
      </div>
    </div>
  )
}

function Slot({
  label,
  initial,
  selected,
  other,
  onPick,
  onClear,
}: {
  label: string
  initial: PickerFounder[]
  selected: PickerFounder | null
  /** The other side's pick, hidden from this list — nobody compares with themselves. */
  other: PickerFounder | null
  onPick: (founder: PickerFounder) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PickerFounder[]>(initial)

  /*
   * Debounced, and every stale response is discarded.
   *
   * Without the generation check, a slow request for "z" can land after a fast
   * one for "zach" and repopulate the list with the wrong answer — the classic
   * typeahead race, and one that only shows up on a bad connection.
   */
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults(initial)
      return
    }
    let live = true
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/founders?q=${encodeURIComponent(q)}`)
        if (!response.ok) return
        const data = (await response.json()) as { founders: PickerFounder[] }
        if (live) setResults(data.founders)
      } catch {
        // A failed lookup leaves the previous list in place, which is a better
        // answer than an empty one.
      }
    }, 180)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [query, initial])

  const matches = useMemo(() => results.filter((f) => f.handle !== other?.handle), [results, other])

  const picked = selected

  if (picked) {
    return (
      <div className="picker-slot">
        <span className="label">{label}</span>
        <div className="picker-chosen">
          <span className="qsquare picker-level serif" style={{ color: picked.rarity.hex }}>
            {picked.level}
          </span>
          <span className="picker-chosen-body">
            <span className="picker-name serif">{picked.displayName}</span>
            <span
              className="picker-class label"
              style={{ color: CLASS_COLORS[picked.characterClass] }}
            >
              <WowIcon
                slug={CLASS_ICONS[picked.characterClass]}
                glyph={picked.characterClass}
                size={16}
                bare
              />
              {picked.characterClass}
            </span>
          </span>
          <button type="button" className="picker-clear label" onClick={onClear}>
            Change
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="picker-slot">
      <span className="label">{label}</span>
      <input
        className="picker-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="name or handle"
        aria-label={`${label} founder`}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
      />
      <ul className="picker-list">
        {matches.map((f) => (
          <li key={f.handle}>
            <button type="button" onClick={() => onPick(f)}>
              <span className="qsquare picker-level serif" style={{ color: f.rarity.hex }}>
                {f.level}
              </span>
              {/* The class emblem, which the row was missing entirely: a list of
                  levels and names says nothing about who any of them are, and
                  the class is the one fact that makes a founder worth comparing
                  against. */}
              <WowIcon
                slug={CLASS_ICONS[f.characterClass]}
                glyph={f.characterClass}
                size={18}
                bare
                className="picker-class"
                color={CLASS_COLORS[f.characterClass]}
              />
              <span className="picker-name">{f.displayName}</span>
              <span className="picker-handle muted">@{f.handle}</span>
            </button>
          </li>
        ))}
        {matches.length === 0 && <li className="picker-empty muted">Nobody by that name.</li>}
      </ul>
    </div>
  )
}
