# Indiecraft

**A public armory for indie founders.** Your lifetime revenue is your XP, every stat you have is an equipment slot, and your item level is the average of what you are wearing. No account, nothing to install, one URL: `indiecraft.quest/c/yourhandle`.

The numbers come from [TrustMRR](https://trustmrr.com). The formula is entirely in this repo — you don't have to take our word for it, you can read it.

---

## How it works

**The character is the founder, not the startup.** "5 products shipped" is a stat about a person. All of your metrics are the sum of your products.

```
XP    = lifetime revenue in dollars + 500 per product shipped
level = the last tier reached in the table below
iLvl  = the average item level of the gear you are wearing
```

Level is what you have banked and cannot lose. Item level is what you are carrying right now: every stat on your sheet is one of seventeen equipment slots, each piece scores from where that stat sits on its own ladder, and your iLvl is their mean — which is how the game computes it too. A slot TrustMRR never filled is left out of the average rather than counted as a zero, because no data is not a bad score.

There is deliberately no gap between the two numbers any more. iLvl used to be MRR projected over twelve months, which put it on the level scale and made `iLvl − level` mean something; the mean of a paper doll is a different scale, and the reference has level 60 characters at item level 66 without ever subtracting one from the other. What a player actually reads off a paper doll is how many slots are filled, and that is what the sheet prints.

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
| 1 | **Adventurer** | No products yet, or nothing earned yet | 15% |
| 2 | **Mage** | Builds on `openai` or `anthropic` | 8% |
| 3 | **Hunter** | An SEO channel with domain rating 30+, or domain rating 50 on its own | 7% |
| 4 | **Warlock** | Buys acquisition: search, social or influencer ads | 3% |
| 5 | **Shaman** | Runs on an audience they built — X, YouTube, a newsletter | 6% |
| 6 | **Priest** | Measured retention above 60% across more than 50 customers | 1% |
| 7 | **Monk** | Real lifetime revenue and no recurring revenue at all | 23% |
| 8 | **Rogue** | $300 or more per customer per month | 3% |
| 9 | **Warrior** | 25+ paying, under $30 each | 8% |
| 10 | **Paladin** | 3+ paying, $30 or more each | 9% |
| 11 | **Evoker** | Real revenue that the rules above cannot yet place | 16% |

`Adventurer` sits first and almost never fires there: one product grants 500 XP, which is already level 17, so `level < 5` is out of reach for anybody who has shipped. Its 15% arrives at the other end of the tree, where nothing matched and the default applies — and since `Evoker` now takes everyone with revenue, that default means exactly one thing: shipped something, earned nothing yet. It is neutral and never demeaning; nobody should be able to read their class as a joke.

`Monk` means you sell outright — nothing to renew, nothing to churn. Gumroad is a Monk.

The shares are measured over the real corpus, not estimated, and they have been re-measured twice. The first tree keyed on a `customers` field that TrustMRR populates 16% of the time, and 66% of founders came out Adventurer — a ladder where two thirds of people sit in the "we don't know" class isn't a game; size now falls back to `activeSubscriptions` (78% coverage) when `customers` is missing. The second retune came when the crawler stopped seeing only the top 200 listings, which were the best-documented ones and had quietly been what the tree was fitted to. Against the rest of the corpus the base-size floors were far too high: 45 founders with real MRR and a real customer count were rejected for having fewer than ten, and four subscribers at $139 is a business. The floors came down to 25 and 3, and `Evoker` was added as the last rule that can see anything — because "we don't know" is the wrong answer for somebody with money coming in.

### Talents

A class is one word, and two founders can share it while having nothing else in common. Talents are the same fact at a finer grain: **three trees per class, one point per level from 10, fifty-one at 60**, and the deepest tree names the spec.

```
Mage — Fire 31/11/9      taking off: growth is the deepest tree
Mage — Frost 9/11/31     nothing melts: retention, or a margin that holds
```

Vanilla rules. No hero talents, no per-talent ranks, and nothing anybody picks — there is no player here to spend the points, so they are apportioned across the three trees by three numbers already on the sheet, largest remainder, so the integers always sum to the points available.

Each tree is mapped to the stat the reference already named it after, and not one of them is a new field: every signal is something the equipment table above already scores. A tree whose stat TrustMRR never reported takes no points rather than a zero — the same rule an empty equipment slot follows — so a thin listing produces a lopsided build rather than a wrong one.

Adventurer has no trees, because it is not a class: it is the state of having none yet. Full table, with the signal and the saturation anchor behind every tree: [`engine/tuning.ts`](engine/tuning.ts), section 9.

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

Thirty-five, all retroactive, all phrased positively. An earned achievement is never lost, even if the condition becomes false again. Full list: [`engine/tuning.ts`](engine/tuning.ts).

---

## Your sheet

**Every sheet is indexed, and that is a decision rather than a default.** It used to be claimed-only, on the theory that consent and interest are the same gesture. The gesture never happened — one claim in 3,900 — and the cost was that the only free discovery channel the site has was switched off, so the founders whose numbers are already public on TrustMRR could not find the page about them either. TrustMRR's founder has since agreed to the whole corpus being indexed, which is the permission that was actually missing.

**Claiming buys a dofollow link.** Your products are always linked, but the link is `nofollow` until you claim the sheet — then it becomes a real backlink. It bounds the risk: an armory passing rank to hundreds of unvetted sites is how a directory gets read as a link farm, so only the links of people who put their hand up carry any weight.

**Removal is one click, and only yours to make.** Sign in with X on your own sheet and it is gone immediately — no email, nothing to wait for. The endpoint used to take the handle from the request body, which meant "anyone can remove their own sheet" was also "anyone can remove anyone's", and `/ladder` hands out a hundred handles at a time. The fix was not a better rate limit: the only handle the route can act on now is the one in the signed session cookie. Claiming is the way back, because a removed sheet 404s and its owner cannot otherwise reach the page to change their mind. Anyone already removed stays removed.

**Unclaiming is the middle option.** It keeps the sheet and puts the product links back to `nofollow`, for somebody who regrets the backlink rather than the page. The alternative used to be "delete everything".

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

Claiming is off until that last one has been run: without `X_API_KEY` and
`X_API_SECRET` the sign-in, claim and removal routes all return 404. Nothing
else changes — sheets are indexed and submitted either way, because indexing no
longer depends on anybody claiming anything. What is missing is the ability to
consent to, or opt out of, being in it.

### Architecture

```
GitHub Actions (nightly, 02:00 UTC)
  ├─> scripts/crawl.ts                cut off at 150 min, under the job's 180
  │     ├─> TrustMRR API v1
  │     └─> Postgres: snapshots (raw jsonb payload + extracted columns)
  └─> POST /api/cron/compute          `if: always()` — finished, failed or cut

Vercel Cron (07:00 UTC, for the night the workflow never ran)
  └─> /api/cron/compute
        └─> pure engine → founders, characters, achievements
        └─> revalidate: the only thing that makes any of it visible

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
| `X_API_KEY` / `X_API_SECRET` | X OAuth 1.0a consumer keys — claiming and removal are off without them |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | Optional OAuth 2.0 fallback, used only when the 1.0a keys are absent |
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
