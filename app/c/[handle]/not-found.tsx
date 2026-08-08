import Link from 'next/link'
import { Frame } from '@/components/frame'
import { InspectSearch } from '@/components/inspect-search'

/**
 * Reached two ways: a handle nobody has crawled, and a founder who opted out.
 *
 * The wording has to cover both without leaking which — saying "this person
 * removed their sheet" would undo the removal. "No such character" is true
 * either way, and it is the sentence the game itself uses.
 */
export default function NotFound() {
  return (
    <main className="page">
      <Frame className="hero">
        <h1 className="serif" style={{ fontSize: 26, margin: '0 0 6px', letterSpacing: '0.08em' }}>
          NO SUCH CHARACTER
        </h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Nobody by that handle on this realm.
        </p>
        <InspectSearch />
        <p className="hero-note muted">
          Characters come from <a href="https://trustmrr.com">TrustMRR</a>. If a founder isn&rsquo;t
          listed there, they have no sheet here.
        </p>
      </Frame>

      <p style={{ marginTop: 22, textAlign: 'center' }}>
        <Link href="/ladder" className="label">
          Browse the ladder →
        </Link>
      </p>
    </main>
  )
}
