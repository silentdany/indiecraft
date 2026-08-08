-- Indiecraft — single schema file, idempotent and replayable.
-- No migration tool. This file is the source of truth.
--
-- Two very unequal categories:
--   snapshots, consent_events ... IRREPLACEABLE. Append-only. Never dropped.
--   everything else ............. derived. See db/reset-derived.sql.
--
-- The discipline to hold: never write a destructive command against either of
-- the two irreplaceable tables. snapshots cannot be re-fetched (the API only
-- returns current state); consent_events cannot be re-derived at all, because
-- it records what people asked for.

-- ---------------------------------------------------------------------------
-- Source of truth. Append-only, never updated.
-- ---------------------------------------------------------------------------
create table if not exists snapshots (
  id                    bigserial primary key,
  -- Escape hatch: 'trustmrr' | 'stripe_direct'. Present from day one so the
  -- second source needs no migration.
  source                text        not null default 'trustmrr',
  startup_slug          text        not null,
  captured_on           date        not null default current_date,
  raw                   jsonb       not null,
  -- extracted columns, so we can query without parsing the jsonb
  mrr_cents             bigint,      -- revenue.mrr
  revenue_total_cents   bigint,      -- revenue.total, lifetime
  last30d_cents         bigint,      -- revenue.last30Days
  customers             int,
  active_subscriptions  int,         -- retention proxy, paired with customers
  growth_mrr_30d        numeric,     -- growthMRR30d, 8.5 = +8.5%
  domain_rating         int,
  visitors_30d          int,
  funding_status        text,        -- bootstrapped | vc-funded
  founded_date          date,
  founder_handle        text,        -- from xHandle
  captured_at           timestamptz not null default now(),
  -- Run idempotency: one row per (source, slug, day).
  unique (source, startup_slug, captured_on)
);
create index if not exists snapshots_slug_day_idx on snapshots (startup_slug, captured_on desc);
create index if not exists snapshots_founder_idx  on snapshots (founder_handle);
create index if not exists snapshots_day_idx      on snapshots (captured_on desc);

-- ---------------------------------------------------------------------------
-- The second source of truth: what people asked for.
--
-- `founders.opted_out_at` and `founders.claimed_at` are the only two values in
-- the whole schema that no amount of crawling can reconstruct. Keeping them
-- only on a derived table means one `--reset` silently republishes every sheet
-- somebody asked to remove. So the events live here, append-only, and the
-- compute step replays them onto founders.
-- ---------------------------------------------------------------------------
create table if not exists consent_events (
  id           bigserial primary key,
  handle       text        not null,
  action       text        not null check (action in ('opt_out', 'claim')),
  occurred_at  timestamptz not null default now(),
  -- A salted hash, never a raw IP. This table records people exercising a
  -- privacy right; it must not become a log of who they are. The hash exists
  -- for exactly one purpose: rate limiting, and spotting a mass wipe.
  ip_hash      text,
  user_agent   text
);
create index if not exists consent_events_handle_idx on consent_events (handle, occurred_at desc);
create index if not exists consent_events_ip_idx     on consent_events (ip_hash, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Rebuildable from snapshots.
-- ---------------------------------------------------------------------------
create table if not exists startups (
  slug            text primary key,
  name            text,
  website         text,
  icon_url        text,
  founder_handle  text,
  funding_status  text,
  first_seen_at   timestamptz not null default now(),
  -- A slug seen yesterday and absent today is not deleted, just stale here.
  last_seen_at    timestamptz not null default now()
);
create index if not exists startups_founder_idx on startups (founder_handle);

create table if not exists founders (
  handle          text primary key,
  display_name    text,
  avatar_url      text,
  claimed_at      timestamptz,   -- null = unclaimed => noindex, nothing negative shown
  opted_out_at    timestamptz,   -- null = visible; otherwise an immediate 404
  first_seen_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Derived, recomputed on every engine run.
-- ---------------------------------------------------------------------------
create table if not exists characters (
  handle              text primary key references founders(handle) on delete cascade,
  xp                  bigint not null,
  level               int    not null,
  -- Nullable on purpose: a founder with no recurring revenue has no monthly
  -- score, and storing 1 would mean "worst gear" instead of "not applicable".
  ilvl                int,
  class               text   not null,
  n_products          int    not null,
  mrr_cents           bigint not null,
  revenue_total_cents bigint not null,
  customers           int    not null default 0,
  active_subscriptions int   not null default 0,
  growth_mrr_30d      numeric,
  -- Memory of the recent event, for the OG image variant.
  previous_level      int,
  leveled_at          timestamptz,
  computed_at         timestamptz not null default now()
);
create index if not exists characters_ladder_idx on characters (level desc, ilvl desc);
create index if not exists characters_class_idx  on characters (class);

-- Which founders a product belongs to. A product belongs to its owner AND to
-- every cofounder, so `startups.founder_handle` alone is not enough: without
-- this table a cofounder's sheet counts a product in n_products but shows no
-- gear for it, and the sheet contradicts itself.
create table if not exists founder_startups (
  handle       text not null,
  startup_slug text not null,
  role         text not null default 'founder',  -- founder | cofounder
  primary key (handle, startup_slug)
);
create index if not exists founder_startups_handle_idx on founder_startups (handle);

-- Append-only: an earned achievement is never lost, even if the condition
-- becomes false again. The compute step inserts with `on conflict do nothing`.
create table if not exists character_achievements (
  handle          text not null references founders(handle) on delete cascade,
  code            text not null,
  earned_on       date not null default current_date,
  primary key (handle, code)
);
create index if not exists achievements_recent_idx on character_achievements (earned_on desc);

-- Guild graph, fed by the API's cofounders field.
-- Stored normalized: a_handle < b_handle, one row per pair.
create table if not exists cofounder_edges (
  a_handle text not null,
  b_handle text not null,
  primary key (a_handle, b_handle),
  check (a_handle < b_handle)
);
create index if not exists cofounder_edges_b_idx on cofounder_edges (b_handle);
