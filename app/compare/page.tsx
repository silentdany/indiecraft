import type { Metadata } from 'next'
import { ComparePicker } from '@/components/compare-picker'
import { getComparableFounders } from '@/lib/queries'

export const revalidate = 300

/**
 * `noindex`, on the same grounds as the comparison pages it leads to: this is a
 * tool, and it names every founder in the corpus on one page. The ladder
 * already carries that exposure once and is left as it was; a second listing of
 * the same people is not something to hand a crawler because it happened to be
 * cheap to build.
 */
export const metadata: Metadata = {
  title: 'Compare founders',
  description: 'Put two indie founders side by side, stat for stat.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/compare' },
}

export default async function Compare({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>
}) {
  const [{ a, b }, founders] = await Promise.all([searchParams, getComparableFounders()])

  // A handle in the query string only pre-fills a slot if it belongs to
  // somebody comparable — an opted-out or misspelled one leaves the slot empty
  // rather than showing a name the picker cannot resolve.
  const known = (handle?: string) =>
    handle && founders.some((f) => f.handle === handle.toLowerCase())
      ? handle.toLowerCase()
      : undefined

  return (
    <main className="page">
      <header className="page-head">
        <h1 className="serif gold">COMPARE</h1>
        <p className="muted">
          Two founders, stat for stat. Nobody loses — a row only appears where both sides have the
          number, and the higher one is marked.
        </p>
      </header>

      <ComparePicker founders={founders} initialA={known(a)} initialB={known(b)} />
    </main>
  )
}
