import Link from 'next/link'
import { Frame } from '@/components/frame'
import { InspectSearch } from '@/components/inspect-search'
import { AGENT_LINKS } from '@/lib/markdown/site'

/**
 * The site-wide 404, which until now was Next's built-in one.
 *
 * Next already returned a real 404 status, so nothing was broken; what was
 * missing was a body worth reading. A crawler that hits a dead URL and gets an
 * app shell learns that the address exists. One that gets four links learns the
 * shape of the whole site in a single response, which is the same reason the
 * markdown twin of this page exists in lib/markdown/site.ts.
 *
 * The list is read from `AGENT_LINKS` rather than written out here, so the two
 * 404s — this one and the markdown one an agent gets from the same URL — cannot
 * drift apart. The one that drifted would be the one nobody looks at.
 *
 * The search box is here for the same reason it is on the character 404: the
 * most common way to land on a dead URL is typing a handle that has no sheet.
 */
export default function NotFound() {
  return (
    <main className="page">
      <Frame className="hero">
        <h1 className="serif" style={{ fontSize: 26, margin: '0 0 6px', letterSpacing: '0.08em' }}>
          NO SUCH PAGE
        </h1>
        <p className="muted" style={{ marginTop: 0 }}>
          That address is not part of this realm.
        </p>
        <InspectSearch />
      </Frame>

      <section className="sheet-section">
        <h2 className="serif">WHERE TO LOOK NEXT</h2>
        <ul className="realm-list">
          {AGENT_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="realm-row">
                <span className="realm-name">{link.label}</span>
                <span className="realm-count label">{link.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
