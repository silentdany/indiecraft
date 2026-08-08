import Link from 'next/link'
import { BrandMark } from '@/components/brand-mark'
import { getLastComputedAt } from '@/lib/queries'

const REPO = 'https://github.com/silentdany/indiecraft'

/**
 * The site footer.
 *
 * It exists to answer, on every page, the three questions a stranger who finds
 * their own name on a leaderboard actually has: where did you get this, who
 * decided what it means, and how do I get out. Burying any of those behind a
 * link to a repo would be answering a different question.
 *
 * The freshness line is not decoration either. Everything here is a nightly
 * snapshot, and a number with no date on it invites people to read it as live.
 */
export async function SiteFooter() {
  const computedAt = await getLastComputedAt().catch(() => null)

  return (
    <footer className="sitefooter">
      <div className="sitefooter-inner">
        <div className="sitefooter-brand">
          <Link href="/" className="serif">
            <BrandMark size={26} />
            <span>
              <span className="sitefooter-over">World of</span>
              <br />
              INDIECRAFT
            </span>
          </Link>
          <p className="muted">
            A public armory for indie founders. Lifetime revenue is XP, MRR is item level, products
            are gear.
          </p>
        </div>

        <nav className="sitefooter-col" aria-label="Armory">
          <p className="label">Armory</p>
          <Link href="/ladder">The ladder</Link>
          <Link href="/rules">The rules</Link>
          <Link href="/rules#the-class-tree">Classes</Link>
        </nav>

        <nav className="sitefooter-col" aria-label="The numbers">
          <p className="label">The numbers</p>
          <a href="https://trustmrr.com">TrustMRR</a>
          <a href={`${REPO}/blob/main/engine/tuning.ts`}>The formula</a>
          <a href={REPO}>Source</a>
        </nav>

        <div className="sitefooter-col">
          <p className="label">Your sheet</p>
          <p className="muted sitefooter-note">
            Nothing is shown that TrustMRR does not already show, and an unclaimed sheet is never
            indexed. Removal is temporarily by hand while we work out how to check ownership —{' '}
            <a href={`${REPO}/issues`}>ask here</a> and it will be done.
          </p>
        </div>
      </div>

      <div className="sitefooter-base">
        <span className="muted">
          {computedAt
            ? `Last computed ${formatWhen(computedAt)}. Crawled nightly.`
            : 'Crawled nightly.'}
        </span>
        <span className="muted">
          MIT. Not affiliated with, endorsed by, or connected to Blizzard Entertainment.
        </span>
      </div>
    </footer>
  )
}

/** "3 hours ago" beats a timestamp nobody converts from UTC in their head. */
function formatWhen(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 2) return 'just now'
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}
