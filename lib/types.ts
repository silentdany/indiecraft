// Six hand-written interfaces, one per table, used as the type parameter on
// queries:
//
//   const rows = await sql<Founder[]>`select * from founders where handle = ${handle}`
//
// Accepted trade-off: nothing guarantees these match the real schema. Renaming
// a column produces no compile error. At six tables and one developer, that is
// fine. At thirty tables it would not be.

export type SnapshotSource = 'trustmrr' | 'stripe_direct'

export interface Snapshot {
  id: string
  source: SnapshotSource
  startup_slug: string
  captured_on: string
  raw: unknown
  mrr_cents: string | null
  revenue_total_cents: string | null
  last30d_cents: string | null
  customers: number | null
  active_subscriptions: number | null
  growth_mrr_30d: string | null
  domain_rating: number | null
  visitors_30d: number | null
  funding_status: string | null
  founded_date: string | null
  founder_handle: string | null
  captured_at: string
}

export interface Startup {
  slug: string
  name: string | null
  website: string | null
  icon_url: string | null
  founder_handle: string | null
  funding_status: string | null
  first_seen_at: string
  last_seen_at: string
}

export interface Founder {
  handle: string
  display_name: string | null
  avatar_url: string | null
  claimed_at: string | null
  opted_out_at: string | null
  first_seen_at: string
}

export interface Character {
  handle: string
  xp: string
  level: number
  ilvl: number
  class: string
  n_products: number
  mrr_cents: string
  revenue_total_cents: string
  customers: number
  active_subscriptions: number
  growth_mrr_30d: string | null
  previous_level: number | null
  leveled_at: string | null
  computed_at: string
}

export interface CharacterAchievement {
  handle: string
  code: string
  earned_on: string
}

export interface CofounderEdge {
  a_handle: string
  b_handle: string
}
