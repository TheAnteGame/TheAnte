-- 0027 — A window into the cron table (D-091).
--
-- PostgREST cannot see the cron schema, so the console's job list was a hand-kept
-- copy of the schedules and nobody could confirm a moved cron without the SQL
-- editor. This function returns the live ante-* schedules. SECURITY DEFINER so it
-- may read cron.job; executable by the service role only, which is what the
-- console and the schema tooling use. It reads; it cannot change a schedule.

create or replace function ante_cron_jobs()
returns table (jobname text, schedule text, active boolean)
language sql
security definer
set search_path = public
as $$
  select j.jobname::text, j.schedule::text, j.active
  from cron.job j
  where j.jobname like 'ante-%'
  order by j.jobname
$$;

revoke all on function ante_cron_jobs() from public, anon, authenticated;
grant execute on function ante_cron_jobs() to service_role;

comment on function ante_cron_jobs() is 'Live pg_cron schedules for the ante-* jobs (D-091). Read-only; service role only.';
