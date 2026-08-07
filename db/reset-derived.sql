-- Evolving the derived schema = run this file, then db/schema.sql, then
-- re-trigger /api/cron/compute. A few seconds, no tooling.
--
-- WARNING: this file must NEVER touch snapshots. Adding a line here that
-- mentions snapshots destroys the one thing in this project that cannot be
-- recovered.

drop table if exists founder_startups;
drop table if exists character_achievements;
drop table if exists characters;
drop table if exists cofounder_edges;
drop table if exists startups;
drop table if exists founders;
