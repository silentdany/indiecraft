# Indiecraft

**A public armory for indie founders.** Your lifetime revenue is your XP, every stat you have is an equipment slot, and your item level is the average of what you are wearing. No account, nothing to install, one URL: `indiecraft.quest/c/yourhandle`.

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

Deterministic tree, **first match wins**. Order matters: how you build and how you find customers are choices, so they come first; the size and price of the business follow.

| # | Class | Condition | Share |
| --- | --- | --- | --- |
| 1 | **Adventurer** | no products, or level < 5 | — |
| 2 | **Mage** | AI stack (`openai`, `anthropic`) | 4% |
| 3 | **Hunter** | SEO channel with domain rating ≥ 30, or DR ≥ 50 alone | 24% |
| 4 | **Warlock** | paid acquisition (`google-ads`, `meta-ads`, …) | 7% |
| 5 | **Bard** | an audience they built (`twitter`, `youtube`, `newsletter`, …) | 2% |
| 6 | **Priest** | measured retention > 60% on more than 50 customers | 4% |
| 7 | **Monk** | real lifetime revenue, no recurring revenue at all | 17% |
| 8 | **Rogue** | ARPU ≥ $300 | 10% |
| 9 | **Warrior** | 100+ paying, ARPU < $30 | 17% |
| 10 | **Paladin** | 10+ paying, ARPU ≥ $30 | 13% |
| — | **Adventurer** | default | 1% |

`Adventurer` is the class of insufficient data. It's neutral and never demeaning: nobody should be able to read their class as a joke. `Monk` means you sell outright — nothing to renew, nothing to churn. Gumroad is a Monk.

The shares are measured over the real corpus, not estimated. The first version of this tree keyed on a `customers` field that TrustMRR populates 16% of the time, and 66% of founders came out Adventurer — a ladder where two thirds of people sit in the "we don't know" class isn't a game. The rules now lead with the fields that actually exist, and size falls back to `activeSubscriptions` (78% coverage) when `customers` is missing.

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

**It is not indexed until you claim it.** Your products are always linked, but the link is `nofollow` until you claim the sheet — then it becomes a real dofollow backlink. Consent and interest are the same gesture. It also bounds the risk: an armory passing rank to hundreds of unvetted sites is how a directory gets read as a link farm, so only the links of people who put their hand up carry any weight.

**An unclaimed sheet shows nothing negative.** No declining trend, no iLvl trough. The negative only appears after you claim it, once you've chosen to be here.

**Removal is temporarily unavailable from the sheet.** The button was one unauthenticated click, which meant anyone could remove anyone — a competitor, or a passer-by working down the ladder. It is disabled, endpoint included, until ownership can be checked. Ask via [an issue](https://github.com/silentdany/indiecraft/issues) in the meantime and it will be done by hand. Anyone already removed stays removed.

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
| `bash scripts/setup-x-auth.sh` | Walks you through creating the X OAuth app that lets founders claim their sheet |

Claiming is off until that last one has been run: without `X_CLIENT_ID` and
`X_CLIENT_SECRET` the sign-in, claim and removal routes all return 404, every
sheet stays `noindex`, and the sitemap holds only the three static pages. The
site works fine that way — it just cannot be found, and nobody can consent to
being in it.

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
  ├─> /c/{handle}                   character sheet
  ├─> /c/{handle}/vs/{other}        two sheets, stat for stat
  ├─> /c/{handle}/badge.svg         embeddable, self-updating badge
  ├─> /c/{handle}/opengraph-image   the card that travels
  └─> /ladder                       ranking, filterable by class, faction, realm
```

The OG image sits under the route segment it describes and **must never move
under `/api/`**: `robots.txt` disallows that prefix, and Twitterbot,
facebookexternalhit, LinkedInBot and Slackbot all read robots.txt before
fetching an image named in a meta tag. It lived there once and every card
silently failed to render while returning a perfectly good 200 to anyone who
checked by hand.

The crawl **cannot** run on Vercel. The corpus is ~200 startups listed ten per page, so a full run is ~20 list requests plus ~200 detail requests at a 4s throttle — roughly fifteen minutes, still far past a serverless function's ceiling. GitHub Actions gives six hours and writes straight to the database.

Three things about the TrustMRR API that its docs don't say, measured on 2026-08-08 and worth knowing before you touch `lib/trustmrr.ts`:

- Every response is wrapped in a `{ "data": … }` envelope.
- Money is in **dollars with decimals**, not cents. We convert on the way in so the `*_cents` columns stay honest integers.
- `customers` is `0` on most listings while `activeSubscriptions` holds the real count. The engine treats that as *missing data*, never as zero retention — nobody loses item levels over a field they never filled in.

### Two ground rules, never to be broken

1. **Never write a destructive command that touches `snapshots`, `consent_events` or `character_days`.** They are the three irreplaceable tables. The API returns current state only, so a lost day of history never comes back; `consent_events` records what people asked for, so dropping it republishes every sheet somebody asked to remove; and `character_days` holds where each founder *stood* on a given day, which depends on everybody else's numbers that day and so can only be re-invented, never recomputed. Everything else is derived and recomputes in seconds. `scripts/apply-schema.ts` refuses to run a reset that mentions any of them.
2. **Never import `supabase-js`.** Supabase is only a Postgres host here. With `postgres.js` on the raw connection string, a `pg_dump` is enough to leave.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `TRUSTMRR_API_KEY` | TrustMRR API key |
| `DATABASE_URL` | Transaction pooler, port 6543 — the app (`prepare: false` mandatory) |
| `DIRECT_URL` | Session pooler, port 5432 — the crawler (see note below) |
| `CRON_SECRET` | Protects `/api/cron/compute` |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | X OAuth 2.0 app — claiming is off without them |
| `AUTH_SECRET` | Signs the session cookie (falls back to `CRON_SECRET`) |
| `NEXT_PUBLIC_POSTHOG_KEY` | Analytics |
| `NEXT_PUBLIC_SITE_URL` | Base for absolute OG URLs, and the OAuth `redirect_uri` |

> **On `DIRECT_URL`:** Supabase's true direct endpoint (`db.<ref>.supabase.co:5432`) resolves to IPv6 only. GitHub Actions runners and most local machines are IPv4-only, so point `DIRECT_URL` at the **session pooler** (`aws-0-<region>.pooler.supabase.com:5432`). It's IPv4, and unlike the transaction pooler it supports prepared statements and long transactions.

---

## Contributing

Rebalancing PRs are welcome and touch exactly one file: [`engine/tuning.ts`](engine/tuning.ts). See [CONTRIBUTING.md](CONTRIBUTING.md).

Founder sheets are not editable by PR. The repo is the code, not the admin panel.

## License

[MIT](LICENSE).
