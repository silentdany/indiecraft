/**
 * TrustMRR API v1 client.
 *
 * Non-negotiable constraints:
 *   - 20 requests/minute. We throttle to 3.5s to keep headroom.
 *   - On 429: exponential backoff, 3 attempts, then skip and log. One failed
 *     slug must never abort the run.
 *
 * Two things the spec got wrong, corrected against live responses on
 * 2026-08-08 and worth knowing before you touch this file:
 *
 *   1. Every response is wrapped in a `{ "data": … }` envelope.
 *   2. Money is in DOLLARS with decimals, not cents. `revenue.total` for
 *      Gumroad comes back as 878595860.52, i.e. $878M lifetime. We multiply by
 *      100 on the way into the database so the `*_cents` columns stay integers
 *      and stay honest.
 *
 * Re-read the acceptable use terms before publishing anything:
 * https://trustmrr.com/terms#api-acceptable-use
 */

export const TRUSTMRR_BASE = 'https://trustmrr.com/api/v1'

/** Named in TrustMRR's robots.txt, which allows every agent. */
const SITEMAP_URL = 'https://trustmrr.com/startup-sitemap.xml'

/** 4s per request: 15 req/min, comfortably under the limit of 20. */
export const THROTTLE_MS = 4_000

/**
 * The quota is per minute, so the only backoff that actually clears a 429 is
 * one that outlasts the window. Starting at 5s just burns all three attempts
 * inside the same minute and fails the run.
 */
const RATE_LIMIT_BACKOFF_MS = 65_000

/** Transient server errors, on the other hand, usually clear in seconds. */
const SERVER_ERROR_BACKOFF_MS = 5_000

/** Server-side cap on `limit`. Asking for more still returns 10. */
export const PAGE_SIZE = 10

/** Safety stop. The corpus is ~200 startups, i.e. ~20 pages. */
const MAX_PAGES = 500

interface ListMeta {
  total?: number
  page?: number
  limit?: number
  hasMore?: boolean
}

/** Shape of a startup detail. The engine must depend on nothing else. */
export interface TrustmrrStartup {
  slug: string
  name?: string | null
  website?: string | null
  icon?: string | null
  xHandle?: string | null
  xFollowerCount?: number | null
  /** Real founder name. Absent from the spec, present in every live response. */
  xFounderName?: string | null
  /** Founder avatar — a face, far better than a product icon. */
  xProfilePicture?: string | null
  foundedDate?: string | null
  rank?: number | null
  revenue?: {
    total?: number | null
    mrr?: number | null
    last30Days?: number | null
  } | null
  customers?: number | null
  activeSubscriptions?: number | null
  growthMRR30d?: number | null
  domainRating?: number | null
  visitorsLast30Days?: number | null
  revenuePerVisitor?: number | null
  techStack?: { slug: string }[] | null
  marketingChannels?: { slug: string; category?: string }[] | null
  cofounders?: { xHandle?: string | null }[] | null
  /** ISO 3166-1 alpha-2, on 62% of listings. The character's realm. */
  country?: string | null
  /** 'B2B' | 'B2C' | 'Both', on 55%. Fallback for the insight below. */
  targetAudience?: string | null
  startupInsights?: {
    fundingStatus?: string | null
    /** Same three answers as targetAudience, on 65%. The character's faction. */
    businessType?: string | null
  } | null
}

export class TrustmrrClient {
  private lastRequestAt = 0

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = TRUSTMRR_BASE,
  ) {
    if (!apiKey) throw new Error('TRUSTMRR_API_KEY is not set')
  }

  /**
   * Every slug, page by page.
   *
   * Two server behaviours worth knowing, both measured rather than documented:
   * the default page size is 1, and `limit` is capped server-side at
   * PAGE_SIZE — asking for 100 still returns 10. We drive the loop off
   * `meta.hasMore` and stop on an empty page either way, so a change to the
   * envelope costs us a short run, never a night of history.
   */
  async listSlugs(limitTo?: number): Promise<string[]> {
    const slugs: string[] = []
    let consecutiveFailures = 0

    for (let page = 1; page <= MAX_PAGES; page++) {
      let payload: { meta?: ListMeta }
      try {
        payload = await this.get<{ meta?: ListMeta }>(`/startups?page=${page}&limit=${PAGE_SIZE}`)
        consecutiveFailures = 0
      } catch (error) {
        // Same rule as a failed slug: log and keep going. Losing one page costs
        // ten startups for the night; aborting costs all of them. But a wall of
        // failures means the API is down, and grinding on wastes the window.
        console.warn(`  ✗ list page ${page} — ${(error as Error).message}`)
        if (++consecutiveFailures >= 3) break
        continue
      }

      const items = extractArray(payload)
      if (items.length === 0) break

      for (const item of items) {
        const slug = typeof item === 'object' && item ? (item as { slug?: string }).slug : undefined
        if (slug) slugs.push(slug)
      }

      if (limitTo && slugs.length >= limitTo) break
      if (payload?.meta?.hasMore === false) break
      if (items.length < PAGE_SIZE) break
    }

    const unique = [...new Set(slugs)]
    return limitTo ? unique.slice(0, limitTo) : unique
  }

  /**
   * Every slug TrustMRR publishes, from its sitemap.
   *
   * `listSlugs` cannot do this, and the reason took a while to see: the list
   * endpoint is hard-capped at 200. `meta.total` says 200 and means "200 in
   * this list", not "200 in the corpus" — the site itself advertises over two
   * thousand, and the sitemap carries ~9,000. Page 21 returns an empty array,
   * `limit=100` still returns 10, and nothing anywhere says the word "top".
   *
   * So the crawler spent every night collecting the same top 200 by rank and
   * the other nine tenths of TrustMRR did not exist as far as this armory was
   * concerned. A founder outside the top 200 could look themselves up and find
   * nothing, which is how this was finally noticed.
   *
   * robots.txt names this sitemap explicitly and allows every agent, so reading
   * it is exactly what it is published for. Detail lookups still go through the
   * API with the same throttle.
   */
  async sitemapSlugs(): Promise<string[]> {
    const response = await fetch(SITEMAP_URL, { signal: AbortSignal.timeout(60_000) })
    if (!response.ok) throw new Error(`TrustMRR sitemap ${response.status}`)
    const xml = await response.text()

    const slugs = new Set<string>()
    for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      const path = match[1]?.match(/^https:\/\/trustmrr\.com\/startup\/([^/?#]+)$/)
      if (path?.[1]) slugs.add(path[1])
    }
    return [...slugs].sort()
  }

  async detail(slug: string): Promise<TrustmrrStartup> {
    const payload = await this.get<unknown>(`/startups/${encodeURIComponent(slug)}`)
    return unwrap(payload) as TrustmrrStartup
  }

  private async get<T>(path: string): Promise<T> {
    await this.throttle()

    let delay = SERVER_ERROR_BACKOFF_MS
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(`${this.baseUrl}${path}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
        },
      })

      if (res.ok) return (await res.json()) as T

      // 429 and 5xx are transient; nothing else gets better on the third try.
      const retriable = res.status === 429 || res.status >= 500
      if (!retriable || attempt === 3) {
        throw new Error(`TrustMRR ${res.status} on ${path}`)
      }

      if (res.status === 429) delay = Math.max(delay, RATE_LIMIT_BACKOFF_MS)
      const retryAfter = Number(res.headers.get('retry-after')) * 1_000
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : delay)
      delay *= 2
    }
    throw new Error(`TrustMRR: failed after 3 attempts on ${path}`)
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt
    if (elapsed < THROTTLE_MS) await sleep(THROTTLE_MS - elapsed)
    this.lastRequestAt = Date.now()
  }
}

/**
 * Peel the `{ data: … }` envelope. Tolerates its disappearance, because an
 * envelope change must not cost a night of history.
 */
export function unwrap(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const data = (payload as Record<string, unknown>).data
    if (data && typeof data === 'object' && !Array.isArray(data)) return data
  }
  return payload
}

function extractArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    for (const key of ['data', 'startups', 'items', 'results']) {
      const value = (payload as Record<string, unknown>)[key]
      if (Array.isArray(value)) return value
    }
  }
  return []
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Edge conversions
// ---------------------------------------------------------------------------

/** The API sends dollars with decimals; the database stores integer cents. */
export function toCents(dollars: number | null | undefined): number | null {
  return typeof dollars === 'number' && Number.isFinite(dollars) ? Math.round(dollars * 100) : null
}

/** And back out again: the game thinks in dollars. */
export function centsToUsd(cents: number | null | undefined): number {
  return typeof cents === 'number' && Number.isFinite(cents) ? cents / 100 : 0
}

export function asInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null
}

export function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Normalize an X handle: no @, lowercase, no surrounding URL. */
export function normalizeHandle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const handle = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
    ?.toLowerCase()
  return handle && /^[a-z0-9_]{1,15}$/.test(handle) ? handle : null
}

/** Short ISO date, or null. Keeps 'Invalid Date' out of the database. */
export function asDate(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}
