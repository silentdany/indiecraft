import { LadderTable } from '@/components/ladder-table'
import type { LadderPage } from '@/lib/queries'
import fixture from '../data/ladder.json'

/**
 * The ladder, shot for the camera.
 *
 * Same arrangement as the character sheet: the real LadderTable, mounted
 * against a frozen page of real rows. Nothing here is a mock-up, so a close-up
 * on row three is a close-up on somebody's actual standing.
 *
 * The header is reproduced by hand from app/ladder, which keeps it inline. If
 * that page is redesigned this file needs a look; the rows below it follow
 * automatically.
 */
export const ladder = fixture as unknown as LadderPage

const formatCount = (value: number): string => new Intl.NumberFormat('en-US').format(value)

export function Ladder() {
  return (
    <div className="video-page">
      <header className="section-head" data-zoom="heading">
        <h1 className="serif gold" style={{ fontSize: 22, letterSpacing: '0.14em', margin: 0 }}>
          THE LADDER
        </h1>
        <span className="label">{formatCount(ladder.total)} founders</span>
      </header>

      <div data-zoom="table">
        <LadderTable rows={ladder.rows} />
      </div>
    </div>
  )
}
