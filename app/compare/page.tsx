import type { Metadata } from 'next'
import { ComparePicker } from '@/components/compare-picker'
import { getComparableFounders, getPickerFounder } from '@/lib/queries'

/*
 * This page reads searchParams, so Next renders it dynamically and this number
 * has never done anything — it was quietly decorative while the route ran its
 * queries on every single request. Kept at a real value for the day the page
 * stops being dynamic; the caching that actually applies here is on the
 * queries themselves, in lib/queries.ts.
 */
export const revalidate = 86400

/**
 * `noindex`, on the same grounds as the comparison pages it leads to: this is a
 * tool, and searching it surfaces any founder in the corpus. The ladder
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
  const { a, b } = await searchParams

  // A handle in the query string is resolved individually rather than looked up
  // in the browse list: the browse list is the strongest eight, and anybody
  // arriving from a ladder row is almost never in it.
  const [initial, pickedA, pickedB] = await Promise.all([
    getComparableFounders(),
    a ? getPickerFounder(a.toLowerCase()) : null,
    b ? getPickerFounder(b.toLowerCase()) : null,
  ])

  return (
    <main className="page">
      <header className="page-head">
        <h1 className="serif gold">COMPARE</h1>
        <p className="muted">
          Two founders, stat for stat. Nobody loses — a row only appears where both sides have the
          number, and the higher one is marked.
        </p>
      </header>

      <ComparePicker
        initial={initial}
        initialA={pickedA ?? undefined}
        initialB={pickedB ?? undefined}
      />
    </main>
  )
}
