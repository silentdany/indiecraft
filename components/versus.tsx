import Link from 'next/link'
import { WowIcon } from '@/components/wow-icon'
import { CLASS_COLORS, CLASS_ICONS, STAT_ICONS } from '@/engine'
import type { CharacterPage } from '@/lib/queries'
import { versusRows } from '@/lib/versus-rows'

/**
 * Two sheets, one row per stat, and the leader marked on each.
 *
 * The rank panel already dangles the founders above and below as rivals and
 * offers nothing to do about them. This is the thing to do about them — and it
 * is the most shareable page shape there is, because whoever comes out ahead
 * posts it and whoever does not now has a number to beat.
 *
 * Which rows exist and who leads is decided in lib/versus-rows.ts, shared with
 * this page's OG card so the picture that travels cannot contradict the page it
 * links to.
 */
export function Versus({ a, b }: { a: CharacterPage; b: CharacterPage }) {
  return (
    <div className="versus">
      <div className="versus-heads">
        <Head character={a} />
        <div className="versus-vs serif">VS</div>
        <Head character={b} />
      </div>

      <ul className="versus-rows">
        {versusRows(a, b).map((row) => (
          <li key={row.label} className="versus-row">
            <span className={`versus-value serif${row.winner === 'a' ? ' is-ahead' : ''}`}>
              {row.a}
            </span>
            <span className="versus-label label">
              <WowIcon slug={STAT_ICONS[row.icon] ?? null} glyph={row.icon} size={18} bare />
              {row.label}
            </span>
            <span className={`versus-value serif${row.winner === 'b' ? ' is-ahead' : ''}`}>
              {row.b}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Head({ character }: { character: CharacterPage }) {
  return (
    <Link href={`/c/${character.handle}`} className="versus-head">
      <span className="qsquare versus-portrait" style={{ color: character.rarity.hex }}>
        {character.avatarUrl ? (
          // biome-ignore lint/performance/noImgElement: matches the sheet's portrait, which shares no pipeline with next/image.
          <img src={character.avatarUrl} alt="" width={82} height={82} />
        ) : (
          <span className="serif" style={{ fontSize: 30 }}>
            {character.handle.slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>
      <span className="versus-name serif">{character.displayName}</span>
      <span
        className="versus-class label"
        style={{ color: CLASS_COLORS[character.characterClass] }}
      >
        <WowIcon
          slug={CLASS_ICONS[character.characterClass]}
          glyph={character.characterClass}
          size={16}
          bare
        />
        {character.characterClass}
      </span>
      <span className="muted versus-handle">@{character.handle}</span>
    </Link>
  )
}
