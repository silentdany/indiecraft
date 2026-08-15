import Link from 'next/link'
import { Frame } from '@/components/frame'
import { InspectSearch } from '@/components/inspect-search'

/**
 * Reached two ways: a handle nobody has crawled, and a founder who opted out.
 *
 * The wording has to cover both without leaking which — saying "this person
 * removed their sheet" would undo the removal. "No such character" is true
 * either way, and it is the sentence the game itself uses. Both reasons are
 * named below precisely because naming both reveals neither, and the second one
 * is worth somebody knowing exists.
 *
 * ---------------------------------------------------------------------------
 * The page used to stop at that. It said the handle had no sheet, offered a
 * search box, and stated that characters come from TrustMRR — a fact, with
 * nothing to do about it.
 *
 * This is the wrong place to end a sentence. Somebody who hears about the site
 * and types their own handle is the most motivated visitor it will ever get,
 * and the answer they got was a dead end. Worse, it is the answer the site's
 * own author gets: there is no `silentdany` row in `founders`.
 *
 * So the route forward is now the middle of the page, and it is specific —
 * where to go, and what happens afterwards. The URL they just typed is the one
 * their sheet will appear at, which is the only promise here worth making.
 * ---------------------------------------------------------------------------
 */
export default function NotFound() {
  return (
    <main className="page">
      <Frame className="hero">
        <h1 className="serif" style={{ fontSize: 26, margin: '0 0 6px', letterSpacing: '0.08em' }}>
          NO SUCH CHARACTER
        </h1>
        {/*
          Not named, deliberately. A `not-found` boundary receives no params, so
          printing the handle means reading it off the router in a client
          component — and Next defers that one past SSR, which left the line
          blank for anybody without JavaScript. This site renders its tooltips
          and its tabs in CSS for exactly that reason; a 404 that only reads
          correctly once hydrated would be the one page that breaks the rule.
        */}
        <p className="muted" style={{ marginTop: 0 }}>
          Nobody by that handle on this realm.
        </p>
        <InspectSearch />
      </Frame>

      <section className="sheet-section">
        <h2 className="serif">GETTING A SHEET</h2>
        <div className="missing-routes">
          <div className="missing-route">
            <p className="label">If this is you</p>
            <p className="muted">
              Every character here is built from a listing on{' '}
              <a href="https://trustmrr.com">TrustMRR</a>. List your product there and the crawler
              picks it up on its next run — your sheet then appears at this exact address, with a
              level, an item level and whatever achievements you have already earned.
            </p>
            <a href="https://trustmrr.com" className="share-x">
              List on TrustMRR
            </a>
          </div>

          <div className="missing-route">
            <p className="label">If it is not</p>
            <p className="muted">
              Two things put a handle here: nobody has listed that founder yet, or they asked to be
              taken off. Removal is one click and it is honoured immediately, so a missing sheet is
              sometimes a choice rather than a gap.
            </p>
            <Link href="/ladder" className="label">
              Browse the ladder →
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
