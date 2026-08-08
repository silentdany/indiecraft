/**
 * The brand mark: one flared Roman I, and nothing else.
 *
 * A ring, four cardinal spikes, and a flared Roman I at the centre. Three
 * elements and one silhouette — an earlier version stacked a crest, an inner
 * crest and six tick marks, which is four layers competing at 20px in a top
 * bar.
 *
 * The letterform is drawn as a path rather than typeset in Cinzel so its
 * proportions hold identically at 20px and at 176px, and so the mark never
 * depends on a font having loaded. The spikes are based just inside the ring
 * rather than touching it, so the whole thing reads as one shape instead of
 * four points floating around a circle.
 *
 * `currentColor` throughout: the mark takes the gold of wherever it sits.
 *
 * What it is not is the reference's logo with the letter swapped. That mark is
 * registered, this product already borrows the "World of ___" naming, and a
 * close name beside a close mark is what turns homage into confusion. Flat
 * fill, no bevel, no metal — which is the house rule anyway, and what will let
 * this render inside the OG image where Satori supports nothing richer.
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
      fill="currentColor"
    >
      {/* The ring. */}
      <circle cx="32" cy="32" r="19" fill="none" stroke="currentColor" strokeWidth="2.4" />

      {/* Four spikes on the diagonals, short and broad. Based inside the ring so
          the whole thing reads as one silhouette rather than four shapes
          orbiting a circle, and set off the axes so they never collide with the
          letter's own horizontals. */}
      <path d="M50.7 50.7 47.6 41.0 41.0 47.6zM13.3 50.7 23.0 47.6 16.4 41.0zM13.3 13.3 16.4 23.0 23.0 16.4zM50.7 13.3 41.0 16.4 47.6 23.0z" />

      {/* The letterform, deliberately small in the ring. The air around it is
          the point: a letter that crowds its container reads as a blob at 23px
          in the top bar. The ring and the spikes went thinner to pay for that
          space rather than the letter growing to fill it. */}
      <g transform="translate(32 32) scale(0.4) translate(-32 -32)">
        <path d="M14 8h36v6.4c-6 .3-11.5 2-13 8.5v18.2c1.5 6.5 7 8.2 13 8.5V56H14v-6.4c6-.3 11.5-2 13-8.5V22.9C25.5 16.4 20 14.7 14 14.4z" />
      </g>
    </svg>
  )
}
