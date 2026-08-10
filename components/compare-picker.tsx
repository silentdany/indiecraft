'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Icon } from '@/components/icon'
import { CLASS_COLORS } from '@/engine'
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
 * The list is filtered in the browser rather than on the server. All 142 rows
 * are a few kilobytes, and a round trip per keystroke would be slower and worse
 * than the thing it replaced.
 *
 * Rows look like ladder rows on purpose: this is the same population, sorted
 * the same way, and a second visual language for it would be a second thing to
 * learn.
 */
export function ComparePicker({
  founders,
  initialA,
  initialB,
}: {
  founders: PickerFounder[]
  initialA?: string
  initialB?: string
}) {
  const router = useRouter()
  const [a, setA] = useState<string | null>(initialA ?? null)
  const [b, setB] = useState<string | null>(initialB ?? null)

  const ready = a !== null && b !== null && a !== b

  return (
    <div className="picker">
      <div className="picker-slots">
        <Slot
          label="First"
          founders={founders}
          selected={a}
          other={b}
          onPick={setA}
          onClear={() => setA(null)}
        />
        <div className="picker-vs serif">VS</div>
        <Slot
          label="Second"
          founders={founders}
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
          onClick={() => ready && router.push(`/c/${a}/vs/${b}`)}
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
  founders,
  selected,
  other,
  onPick,
  onClear,
}: {
  label: string
  founders: PickerFounder[]
  selected: string | null
  /** The other side's pick, hidden from this list — nobody compares with themselves. */
  other: string | null
  onPick: (handle: string) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, '')
    const pool = founders.filter((f) => f.handle !== other)
    if (!q) return pool.slice(0, 8)
    return pool
      .filter((f) => f.handle.includes(q) || f.displayName.toLowerCase().includes(q))
      .slice(0, 8)
  }, [founders, other, query])

  const picked = selected ? founders.find((f) => f.handle === selected) : undefined

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
              <Icon name={picked.characterClass} size={12} />
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
            <button type="button" onClick={() => onPick(f.handle)}>
              <span className="qsquare picker-level serif" style={{ color: f.rarity.hex }}>
                {f.level}
              </span>
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
