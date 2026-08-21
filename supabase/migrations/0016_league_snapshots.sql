-- 0016 — Snapshots of the league record.
--
-- The org is on Supabase's free plan: no automated backups, no point-in-time
-- recovery. A season runs 18 weeks on an append-only ledger, so a bad settlement or
-- a lost database has no floor underneath it. This adds one (D-015).
--
-- Two different jobs, deliberately not conflated:
--   * Rows here are taken automatically right before the operations most likely to
--     go wrong (settlement, re-settlement, force reveal, season close). They live in
--     the same database, so they protect against a BAD WRITE, not against losing the
--     database itself.
--   * The commissioner downloads a file. That copy lives off-platform and is the
--     only thing that protects against losing the project.
--
-- Snapshots are pruned to the most recent 20 by the writer.

create table league_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references players(id),
  reason text not null,
  size_bytes int not null default 0,
  chip_total int,
  payload jsonb not null
);

create index league_snapshots_recent_idx on league_snapshots (created_at desc);

alter table league_snapshots enable row level security;
-- No policy: the whole league record lives in here. Service role only, reachable
-- exclusively past the commissioner check (ANTE-TECH §4.3).
