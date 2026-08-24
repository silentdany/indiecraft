/**
 * Content negotiation between the two things this site can produce.
 *
 * Agents that ask for `text/markdown` should get the page as prose instead of
 * as an armory: the same facts without the frame, the icons, the RSC payload,
 * or the 116 KB of markup the ladder costs in HTML. Browsers keep the armory.
 *
 * The algorithm is acceptmarkdown.com's published one, which is RFC 9110
 * § 12.5.1 rather than a substring test for "markdown". Two rules earn their
 * complexity:
 *
 *   - a more specific range beats a wildcard whatever the q-values say, so
 *     `text/html;q=0, *\/*` means "anything except HTML" and not "HTML is fine";
 *   - equal q ties break on the order the client listed, so
 *     `text/markdown, text/html` picks markdown and the reverse picks HTML.
 *
 * Order matters here: HTML is first, so a browser sending `*\/*` lands on it.
 */
const PRODUCES = ['text/html', 'text/markdown'] as const

export type Produced = (typeof PRODUCES)[number]

type AcceptEntry = { type: string; q: number; specificity: number }

function parseAccept(header: string): AcceptEntry[] {
  return header.split(',').map((raw) => {
    const parts = raw
      .trim()
      .split(';')
      .map((s) => s.trim())
    const type = (parts[0] ?? '').toLowerCase()
    let q = 1
    for (const param of parts.slice(1)) {
      const [name, value] = param.split('=').map((s) => s.trim())
      if (name === 'q') {
        const parsed = Number(value)
        // A q nobody can parse is not a rejection. Dropping the entry would
        // turn one typo into a 406.
        if (!Number.isNaN(parsed)) q = Math.max(0, Math.min(1, parsed))
      }
    }
    const specificity = type === '*/*' ? 0 : type.endsWith('/*') ? 1 : 2
    return { type, q, specificity }
  })
}

function matches(entry: AcceptEntry, candidate: string): boolean {
  if (entry.type === '*/*') return true
  if (entry.type.endsWith('/*')) return candidate.startsWith(entry.type.slice(0, -1))
  return entry.type === candidate
}

/**
 * What to send, or `null` when the client has ruled out everything this site
 * has — the one case that is a 406 rather than a silent fallback.
 */
export function preferredType(header: string | null | undefined): Produced | null {
  if (!header) return PRODUCES[0]
  const entries = parseAccept(header)
  if (entries.length === 0) return PRODUCES[0]

  let bestType: Produced | null = null
  let bestQ = -1
  let bestPosition = Number.POSITIVE_INFINITY

  for (const candidate of PRODUCES) {
    let matched: AcceptEntry | null = null
    let matchedPosition = Number.POSITIVE_INFINITY
    for (let idx = 0; idx < entries.length; idx++) {
      const entry = entries[idx]
      if (!entry) continue
      if (!matches(entry, candidate)) continue
      if (
        matched === null ||
        entry.specificity > matched.specificity ||
        (entry.specificity === matched.specificity && idx < matchedPosition)
      ) {
        matched = entry
        matchedPosition = idx
      }
    }
    if (matched === null) continue
    if (matched.q <= 0) continue

    if (matched.q > bestQ || (matched.q === bestQ && matchedPosition < bestPosition)) {
      bestQ = matched.q
      bestPosition = matchedPosition
      bestType = candidate
    }
  }

  return bestType
}

/**
 * `Vary: Accept` is the half of this that is easy to forget and expensive to
 * omit: without it a CDN hands the cached markdown to the next browser that
 * asks for the same URL, or the cached HTML to the next agent.
 */
export function appendVaryAccept(headers: Headers): void {
  const existing = headers.get('Vary')
  if (!existing) {
    headers.set('Vary', 'Accept')
    return
  }
  const tokens = existing.split(',').map((s) => s.trim().toLowerCase())
  if (!tokens.includes('accept')) headers.set('Vary', `${existing}, Accept`)
}
