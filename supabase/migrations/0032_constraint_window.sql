-- 0032 — A window into the check constraints (D-110).
--
-- schema:check verified columns only, so a migration that just widens a
-- `check (kind in (...))` list was invisible to it. 0030 was exactly that: it added
-- the fold_penalty ledger kind, was never applied to production, and Week 3's
-- settlement died on it at 9:15pm MST on 2026-09-28 while every check stayed green.
--
-- PostgREST cannot see pg_constraint, so this returns the live check constraints on
-- public tables for schema:check to compare against the migration chain. Same shape
-- as ante_cron_jobs (0027): SECURITY DEFINER, service role only. It reads; it
-- cannot change a constraint.

create or replace function ante_check_constraints()
returns table (conname text, table_name text, definition text)
language sql
security definer
set search_path = public
as $$
  select c.conname::text, t.relname::text, pg_get_constraintdef(c.oid)
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where c.contype = 'c' and n.nspname = 'public'
  order by t.relname, c.conname
$$;

revoke all on function ante_check_constraints() from public, anon, authenticated;
grant execute on function ante_check_constraints() to service_role;

comment on function ante_check_constraints() is 'Live check constraints on public tables, for schema:check (D-110). Read-only; service role only.';
