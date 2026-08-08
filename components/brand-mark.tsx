/**
 * The brand mark: an ornate I on a hexagonal crest.
 *
 * Not the reference's logo with a different letter. That mark is registered,
 * the product already borrows its "World of ___" naming, and a close name plus
 * a close mark is exactly what turns homage into confusion. It would also break
 * the first line of the design system: no Blizzard assets, not a font, not an
 * icon, not a pixel.
 *
 * So the mark is assembled from vocabulary this project already owns and uses
 * on every panel — the hexagonal crest, the double frame, the four corner
 * brackets, and the flared Roman serif. It reads as an armory because the rest
 * of the interface does, not because it imitates one.
 *
 * Flat throughout, like everything else: solid fills and 1px strokes, no
 * gradient, no bevel, no glow. That is also what keeps it renderable inside the
 * OG image later, where Satori supports nothing richer.
 */
export function BrandMark({
  size = 40,
  className,
  title,
}: {
  size?: number
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {/* Outer crest, in the frame bronze that carries structure everywhere else. */}
      <path
        d="M32 2.5 59 17.5v29L32 61.5 5 46.5v-29z"
        fill="none"
        stroke="var(--ic-frame, #6b552a)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Inner crest, in the acting gold. The same two-frame rule as .frame. */}
      <path
        d="M32 9 52.5 20.5v23L32 55 11.5 43.5v-23z"
        fill="none"
        stroke="var(--ic-gold, #f8b700)"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />

      {/* The four corner brackets, shrunk from the panel frame onto the crest. */}
      <g stroke="var(--ic-gold, #f8b700)" strokeWidth="1.75" strokeLinecap="round" fill="none">
        <path d="M32 12.4v3.4M32 48.2v3.4M14.9 22.3l2.9 1.7M46.2 40l2.9 1.7M49.1 22.3l-2.9 1.7M17.8 40l-2.9 1.7" />
      </g>

      {/*
        The I. Flared serif bars top and bottom, a narrow stem between them —
        the shape Cinzel gives the letter, drawn rather than typeset so it holds
        at 20px in the top bar and at 96px in the hero.
      */}
      <g fill="var(--ic-butter, #fff468)">
        <path d="M20.5 20.5h23v4.6h-4.4l-1.9 2.1H26.8l-1.9-2.1H20.5z" />
        <path d="M28.9 27.2h6.2v9.6h-6.2z" />
        <path d="M20.5 43.5h23v-4.6h-4.4l-1.9-2.1H26.8l-1.9 2.1H20.5z" />
      </g>
    </svg>
  )
}
