import { Icon } from '@/components/icon'
import type { EquipmentPiece } from '@/lib/queries'

/**
 * A product, rendered as a piece of gear with a proper item tooltip.
 *
 * This is the most WoW-native gesture the product has and the only one that
 * turns an inert row into something you inspect. Everything in the tooltip is
 * data already crawled and never shown: the description, the category, the
 * launch year, the last thirty days of revenue, and the tech stack — which
 * behaves exactly like an item's enchantments and happens to be the detail
 * founders recognise fastest.
 *
 * No JavaScript. `:hover` opens it for a mouse and `:focus-within` opens it for
 * a keyboard or a tap, which is the whole reason the row wraps a real link.
 */
export function GearItem({ piece, linked }: { piece: EquipmentPiece; linked: boolean }) {
  const year = piece.foundedDate?.slice(0, 4)

  return (
    <li className="gear-row">
      <div className="qsquare gear-icon" style={{ color: piece.rarity.hex }}>
        {piece.iconUrl ? (
          // biome-ignore lint/performance/noImgElement: Satori and next/image share no pipeline; visual consistency wins.
          <img src={piece.iconUrl} alt="" width={56} height={56} />
        ) : (
          <span className="serif">{piece.name.slice(0, 1).toUpperCase()}</span>
        )}
      </div>

      <div className="gear-body">
        {/* The dofollow link is what claiming buys; unclaimed sheets get
            nofollow, and a sheet with no website gets plain text. */}
        {piece.website ? (
          <a
            href={piece.website}
            rel={linked ? undefined : 'nofollow'}
            className="gear-name"
            style={{ color: piece.rarity.hex }}
          >
            {piece.name}
          </a>
        ) : (
          <span className="gear-name" style={{ color: piece.rarity.hex }}>
            {piece.name}
          </span>
        )}
        <div className="gear-sub">
          <span className="label">
            {piece.itemLevel === null ? 'no monthly score' : `item level ${piece.itemLevel}`}
          </span>
          {piece.category && <span className="gear-cat">{piece.category}</span>}
          {piece.vcFunded && <span className="gear-flag">VC</span>}
        </div>
      </div>

      <div className="tooltip" role="tooltip">
        <div className="tooltip-name serif" style={{ color: piece.rarity.hex }}>
          {piece.name}
        </div>
        <div className="tooltip-sub">
          {piece.itemLevel === null ? 'No monthly score' : `Item level ${piece.itemLevel}`}
          {piece.category ? ` · ${piece.category}` : ''}
          {piece.country ? ` · ${piece.country}` : ''}
        </div>

        {/* The stat block. Green, like an item's bonuses, and only the lines we
            actually have — a tooltip padded with "—" is worse than a short one. */}
        <div className="tooltip-stats">
          {piece.mrrUsd > 0 && <Stat label="Monthly revenue" value={usd(piece.mrrUsd)} />}
          {piece.last30dUsd > 0 && <Stat label="Last 30 days" value={usd(piece.last30dUsd)} />}
          {piece.customers ? <Stat label="Customers" value={num(piece.customers)} /> : null}
          {piece.domainRating ? (
            <Stat label="Domain rating" value={String(piece.domainRating)} />
          ) : null}
        </div>

        {year && <div className="tooltip-req">Requires: launched {year}</div>}

        {piece.stack.length > 0 && (
          <div className="tooltip-ench">
            <Icon name="gear" size={13} />
            <span>Enchanted: {piece.stack.slice(0, 6).join(', ')}</span>
          </div>
        )}

        {piece.pricingModel && (
          <div className="tooltip-price">{truncate(piece.pricingModel, 90)}</div>
        )}

        {/* Flavour text, in the slot the game keeps for it. */}
        {piece.description && (
          <div className="tooltip-flavour">&ldquo;{truncate(piece.description, 150)}&rdquo;</div>
        )}
      </div>
    </li>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="tooltip-stat">
      <span>{label}</span>
      <span className="tooltip-stat-v">{value}</span>
    </div>
  )
}

const usd = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: v >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: v >= 100_000 ? 1 : 0,
  }).format(v)

const num = (v: number) => new Intl.NumberFormat('en-US').format(v)

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
