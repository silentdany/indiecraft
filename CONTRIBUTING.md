# Contributing to Indiecraft

## What we actually want

**Rebalancing.** The level table and the class tree are going to be argued about, and that's the point: people who do indie hacking know this world better than we do.

Everything tunable lives in one file:

**[`engine/tuning.ts`](engine/tuning.ts)** — level thresholds, rarity bands, the class decision tree, achievement definitions, the equipment table, and the talent trees with the signal and saturation anchor behind each one.

If you have to touch another file to propose a rebalance, the engine has a bug. Open an issue and we'll fix it.

### A good rebalancing PR

- Touches only `engine/tuning.ts` and the matching tests.
- Explains **what it changes for real people**, not just what it changes in the formula. "This moves boilerplate sellers from Rogue to Warrior" is a good argument. "It's more elegant" is not.
- Passes `pnpm test`. The engine is the only tested part of the project, deliberately: it's the only part that deserves fine tuning.

### Three guardrails on classes

**No class may read as a joke at someone's expense.** `Adventurer` is where the tree lands when somebody has shipped and earned nothing yet; it is neutral on purpose, and the catch-all rule at the bottom of the tree exists so that nobody with money coming in is told the armory cannot place them. A class that makes someone look like a failure doesn't ship, even if it's statistically accurate.

**Only the nine classes this game has.** Druid, Hunter, Mage, Paladin, Priest, Rogue, Shaman, Warlock, Warrior — plus `Adventurer`, which is not a class but the state of having none yet. Every item on a sheet derives from a Classic one and the talent rules are Classic's, so a class from a later expansion is as foreign here as an invented one; a Monk and an Evoker lived in the tree for a month before anybody noticed. There are more rules than classes, so a rule may share a class with another as long as each carries its own reason — `engine/character.test.ts` holds the roster.

**The test for every derived label:** would this person be happy to screenshot it? If not, it's a bug, not an opinion.

## What does not go through a PR

**Founder sheets.** They're computed from crawled data, never hand-edited. A PR must not be able to modify a sheet. The repo is the code, not the admin panel.

To have a sheet removed: sign in with X on the sheet itself and press remove. No email, no waiting, immediate effect. Signing in is the whole of the ceremony — it exists because the endpoint used to take the handle from the request body, which made "anyone can remove their own sheet" also "anyone can remove anyone's".

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
