-- 0006 — Job scheduling via pg_cron + pg_net (owner's Vercel plan is Hobby; Supabase
-- rings the bell instead). Each entry calls the CRON_SECRET-gated /api/jobs/*
-- endpoint. REQUIRES a Vault secret named 'cron_secret' holding the same value as
-- the CRON_SECRET env var — created by the owner in the dashboard (Project
-- Settings → Vault), never committed here.
--
-- Times are UTC: the ET-hour pairs (10,11 / 16,17) cover both sides of the DST
-- change; the jobs guard in America/New_York and are idempotent, so the off-hour
-- firing is a harmless no-op. The PRIMARY reveal trigger is event-driven at
-- submission (Phase 6); ante-reveal-check is the fallback poll.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function ante_cron_headers() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'Authorization',
    'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
  )
$$;

select cron.schedule('ante-slate-open', '0 10,11 * * 2',
  $$select net.http_get('https://theantegame.com/api/jobs/slate-open', headers := ante_cron_headers())$$);

select cron.schedule('ante-reveal-check', '*/2 * * * 2-4',
  $$select net.http_get('https://theantegame.com/api/jobs/reveal-check', headers := ante_cron_headers())$$);

select cron.schedule('ante-reveal-deadline', '0,5 16,17 * * 4',
  $$select net.http_get('https://theantegame.com/api/jobs/reveal-deadline', headers := ante_cron_headers())$$);

select cron.schedule('ante-scores-sync', '*/5 * * * *',
  $$select net.http_get('https://theantegame.com/api/jobs/scores-sync', headers := ante_cron_headers())$$);

select cron.schedule('ante-schedule-refetch', '30 8 * * *',
  $$select net.http_get('https://theantegame.com/api/jobs/schedule-refetch', headers := ante_cron_headers())$$);
