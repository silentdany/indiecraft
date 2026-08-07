# Indiecraft

**A public armory for indie founders.** Your lifetime revenue is your XP, your MRR is your item level, your products are your gear. No account, nothing to install, one URL: `indiecraft.dev/c/yourhandle`.

The numbers come from [TrustMRR](https://trustmrr.com). The formula is entirely in this repo — you don't have to take our word for it, you can read it.

---

## How it works

**The character is the founder, not the startup.** "5 products shipped" is a stat about a person. All of your metrics are the sum of your products.

```
XP    = lifetime revenue in dollars + 500 per product shipped
level = the last tier reached in the table below
iLvl  = the level you'd hold if you sustained your current MRR for twelve months
```

The gap between the two is the only genuinely interesting number:

- **iLvl > level** — taking off. Your gear is above your tier.
- **iLvl < level** — veteran in a trough. Big level, rusty gear.

### The level table

A table, not a formula. It's hand-tunable, it explains itself in one screenshot, and it lets level 1 be free without making level 60 unreachable.

| XP | Level |
| --- | --- |
| $1 | 1 |
| $100 | 10 |
| $1,000 | 20 |
| $10,000 | 30 |
| $100,000 | 40 |
| $1,000,000 | 50 |
| $10,000,000 | 60 |

All sixty tiers are interpolated between these anchors: [`engine/tuning.ts`](engine/tuning.ts).

Going from 40 to 41 costs proportionally the same as going from 10 to 11. The first dollar you ever earn dings level 1.

### The classes

Deterministic tree, **first match wins**. Order matters.

| # | Class | Condition |
| --- | --- | --- |
| 1 | **Adventurer** | no products, or level < 5 |
| 2 | **Priest** | retention > 60% and more than 50 customers |
| 3 | **Rogue** | 20 customers or fewer, ARPU > $200 |
| 4 | **Warrior** | more than 500 customers, ARPU < $20 |
| 5 | **Hunter** | SEO channel and domain rating ≥ 30 |
| 6 | **Bard** | X, LinkedIn, YouTube or TikTok channel |
| 7 | **Mage** | AI stack |
| — | **Adventurer** | default |

`Adventurer` is the class of insufficient data. It's neutral and never demeaning: nobody should be able to read their class as a joke.

### Rarity

Indexed on your level. A purple border reads without a single word.

| Level | Rarity |
| --- | --- |
| 1–9 | grey |
| 10–24 | green |
| 25–39 | blue |
| 40–54 | purple |
| 55–60 | orange |

### Achievements

Fifteen, all retroactive, all phrased positively. An earned achievement is never lost, even if the condition becomes false again. Full list: [`engine/tuning.ts`](engine/tuning.ts).

---

## Your sheet

**It is not indexed until you claim it.** Claiming unlocks indexing and the dofollow link to your products. Consent and interest are the same gesture.

**An unclaimed sheet shows nothing negative.** No declining trend, no iLvl trough. The negative only appears after you claim it, once you've chosen to be here.

**One-click removal**, on the sheet, no account, no email, applied immediately.

Nothing is shown that TrustMRR doesn't already show.

---

## Running the project

Node 22+, pnpm, a Postgres.

```bash
pnpm install
cp .env.example .env      # then fill it in
pnpm schema:apply         # creates the tables, idempotent
pnpm crawl --limit 20     # a short run to check the wiring
pnpm dev
```

| Command | What it does |
| --- | --- |
| `pnpm crawl` | Full crawl (~15 min), then triggers the compute step |
| `pnpm crawl --dump-slugs` | Dumps the TrustMRR vocabularies encountered |
| `pnpm compute` | Re-runs the engine over existing snapshots, no server needed |
| `pnpm schema:apply --reset` | Recreates the derived tables (never `snapshots`) |
| `pnpm test` | Engine tests |

### Architecture

```
GitHub Actions (nightly cron)
  └─> scripts/crawl.ts
        ├─> TrustMRR API v1
        └─> Postgres: snapshots (raw jsonb payload + extracted columns)

Vercel Cron (safety net, after the crawl)
  └─> /api/cron/compute
        └─> pure engine → founders, characters, achievements

Next.js App Router (public, read-only)
  ├─> /c/{handle}            character sheet
  ├─> /ladder                ranking
  └─> /api/og/c/{handle}     dynamic OG image
```

The crawl **cannot** run on Vercel. The corpus is ~200 startups listed ten per page, so a full run is ~20 list requests plus ~200 detail requests at a 4s throttle — roughly fifteen minutes, still far past a serverless function's ceiling. GitHub Actions gives six hours and writes straight to the database.

Three things about the TrustMRR API that its docs don't say, measured on 2026-08-08 and worth knowing before you touch `lib/trustmrr.ts`:

- Every response is wrapped in a `{ "data": … }` envelope.
- Money is in **dollars with decimals**, not cents. We convert on the way in so the `*_cents` columns stay honest integers.
- `customers` is `0` on most listings while `activeSubscriptions` holds the real count. The engine treats that as *missing data*, never as zero retention — nobody loses item levels over a field they never filled in.

### Two ground rules, never to be broken

1. **Never write a destructive command that touches `snapshots` or `consent_events`.** They are the two irreplaceable tables. The API returns current state only, so a lost day of history never comes back; and `consent_events` records what people asked for, so dropping it republishes every sheet somebody asked to remove. Everything else is derived and recomputes in seconds. `scripts/apply-schema.ts` refuses to run a reset that mentions either.
2. **Never import `supabase-js`.** Supabase is only a Postgres host here. With `postgres.js` on the raw connection string, a `pg_dump` is enough to leave.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `TRUSTMRR_API_KEY` | TrustMRR API key |
| `DATABASE_URL` | Transaction pooler, port 6543 — the app (`prepare: false` mandatory) |
| `DIRECT_URL` | Session pooler, port 5432 — the crawler (see note below) |
| `CRON_SECRET` | Protects `/api/cron/compute` |
| `NEXT_PUBLIC_POSTHOG_KEY` | Analytics |
| `NEXT_PUBLIC_SITE_URL` | Base for absolute OG URLs |

> **On `DIRECT_URL`:** Supabase's true direct endpoint (`db.<ref>.supabase.co:5432`) resolves to IPv6 only. GitHub Actions runners and most local machines are IPv4-only, so point `DIRECT_URL` at the **session pooler** (`aws-0-<region>.pooler.supabase.com:5432`). It's IPv4, and unlike the transaction pooler it supports prepared statements and long transactions.

---

## Contributing

Rebalancing PRs are welcome and touch exactly one file: [`engine/tuning.ts`](engine/tuning.ts). See [CONTRIBUTING.md](CONTRIBUTING.md).

Founder sheets are not editable by PR. The repo is the code, not the admin panel.

## License

[MIT](LICENSE).
