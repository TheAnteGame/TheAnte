-- 0015 — Frozen moneylines alongside the frozen spread.
--
-- Players read a moneyline faster than a spread, so the slip shows both (D-014).
-- Same status as the spread: display context, frozen at slate open, and never
-- consulted at settlement — ANTE pays by the room's split (rulebook §5), not by odds.
-- Source is nflverse's own away_moneyline / home_moneyline columns; no derived or
-- estimated numbers, so a blank stays blank rather than becoming a guess.

alter table games add column away_moneyline int;
alter table games add column home_moneyline int;

comment on column games.away_moneyline is
  'Display context only, frozen at slate open. Never consulted at settlement (§5).';
comment on column games.home_moneyline is
  'Display context only, frozen at slate open. Never consulted at settlement (§5).';
