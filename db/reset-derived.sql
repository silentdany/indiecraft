-- Evolving the derived schema = run this file, then db/schema.sql, then
-- re-trigger the compute step. A few seconds, no tooling.
--
-- WARNING: this file must NEVER touch snapshots or consent_events. They are
-- the two tables nothing can rebuild:
--
--   snapshots       the API only returns current state, so a lost day of
--                   history never comes back.
--   consent_events  it records what people asked for. Dropping it republishes
--                   every sheet somebody asked to remove.
--
-- Dropping `founders` below is only safe BECAUSE consent_events exists: the
-- compute step replays opted_out_at and claimed_at from it. Remove that replay
-- and this file becomes a privacy incident.
--
-- scripts/apply-schema.ts refuses to run this file if it mentions either table.

drop table if exists founder_startups;
drop table if exists character_achievements;
drop table if exists characters;
drop table if exists cofounder_edges;
drop table if exists startups;
drop table if exists founders;
