import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { storyCardPath } from '@/lib/card-image'
import { parseHandle } from '@/lib/handle'
import { getCharacter } from '@/lib/queries'

/**
 * The free poster tool.
 *
 * A handle in the query is one founder, and a crawler does not need a second
 * copy of a sheet that already lives at /c/<handle>. The tool itself is the
 * page worth indexing.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ handle?: string }>
}): Promise<Metadata> {
  const { handle } = await searchParams
  return {
    title: 'Poster',
    description:
      'A free 9:16 card of an indie founder. One X handle, drawn from the armory. Nothing to type but the name.',
    robots: handle ? { index: false, follow: true } : { index: true, follow: true },
    alternates: { canonical: '/card' },
  }
}

export default async function CardPage({
  searchParams,
}: {
  searchParams: Promise<{ handle?: string }>
}) {
  const { handle: raw } = await searchParams
  const handle = raw ? parseHandle(raw) : ''
  if (raw && handle && raw !== handle) redirect(`/card?handle=${encodeURIComponent(handle)}`)

  const character = handle ? await getCharacter(handle) : null
  const poster = character ? storyCardPath(character.handle, character.level, character.ilvl) : null

  return (
    <main className="page">
      <header className="page-head">
        <h1 className="serif gold">POSTER</h1>
        <p className="muted">
          A 9:16 card of a founder already on the armory. The numbers are TrustMRR’s, so the only
          thing to type is the handle.
        </p>
      </header>

      <form className="inspect inspect-left" action="/card" method="get">
        <span className="inspect-at" aria-hidden="true">
          @
        </span>
        <input
          name="handle"
          defaultValue={handle}
          placeholder="your x handle"
          aria-label="X handle"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
        />
        <button type="submit" className="serif">
          DRAW
        </button>
      </form>

      {raw && !handle && <p className="poster-note muted">That is not an X handle.</p>}
      {handle && !character && (
        <p className="poster-note muted">
          @{handle} is not on the armory. Sheets are drawn from TrustMRR, not from a form.
        </p>
      )}

      {character && poster && (
        <div className="poster">
          {/* biome-ignore lint/performance/noImgElement: the exact bytes the download saves. */}
          <img
            src={poster}
            alt={`${character.displayName}, level ${character.level} ${character.characterClass}`}
            width={1080}
            height={1920}
          />
          <div className="poster-actions">
            <a className="share-x" href={poster} download={`indiecraft-${character.handle}.png`}>
              Save poster
            </a>
            <Link className="share-copy label" href={`/c/${character.handle}`}>
              Open sheet
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}
