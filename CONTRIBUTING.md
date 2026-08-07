# Contributing to Indiecraft

## What we actually want

**Rebalancing.** The level table and the class tree are going to be argued about, and that's the point: people who do indie hacking know this world better than we do.

Everything tunable lives in one file:

**[`engine/tuning.ts`](engine/tuning.ts)** — level thresholds, rarity bands, the class decision tree, achievement definitions.

If you have to touch another file to propose a rebalance, the engine has a bug. Open an issue and we'll fix it.

### A good rebalancing PR

- Touches only `engine/tuning.ts` and the matching tests.
- Explains **what it changes for real people**, not just what it changes in the formula. "This moves boilerplate sellers from Rogue to Warrior" is a good argument. "It's more elegant" is not.
- Passes `pnpm test`. The engine is the only tested part of the project, deliberately: it's the only part that deserves fine tuning.

### Two guardrails on classes

**No class may read as a joke at someone's expense.** `Adventurer` is the class of insufficient data; it is neutral on purpose. A class that makes someone look like a failure doesn't ship, even if it's statistically accurate.

**The test for every derived label:** would this person be happy to screenshot it? If not, it's a bug, not an opinion.

## What does not go through a PR

**Founder sheets.** They're computed from crawled data, never hand-edited. A PR must not be able to modify a sheet. The repo is the code, not the admin panel.

To have a sheet removed: the "Remove my sheet" button on the sheet itself. No account, no email, immediate effect.

To correct a number: it comes from TrustMRR, so that's where it needs correcting.

## Two non-negotiable technical rules

1. **No destructive command against `snapshots` or `consent_events`.** They are the only irreplaceable tables: the API returns current state only, so lost history never comes back, and `consent_events` records what people asked for. Everything else is derived. Dropping `founders` is safe *only* because the compute step replays consent onto it — if you touch that replay, you turn a reset into a privacy incident.
2. **No `supabase-js` import.** Supabase is only a Postgres host. The day we need to leave, a `pg_dump` has to be enough.

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm test          # the engine, no database needed
```

Rebalancing needs no database: the engine is a pure function and the tests run offline.

## Style

Run `pnpm format` before pushing. Biome decides; we don't argue about commas.
