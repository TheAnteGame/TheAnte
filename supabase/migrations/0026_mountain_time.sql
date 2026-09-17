-- 0026 — The league keeps Mountain time (D-089).
--
-- Players are in Denver's zone; a noon-Eastern wall folded people at 10am their
-- time. The code now anchors every week in America/Denver (lib/time.ts). These are
-- the crons that fire at a local hour, moved to the UTC hours that ARE that local
-- hour in both halves of the DST year (MDT = UTC-6, MST = UTC-7). Each job still
-- guards on the local clock, so the extra hour is harmless, as it always was.
--
--   slate open        Tue 6:00am MT   → 12:00 / 13:00 UTC
--   reminders         Wed 6:00pm MT   → Thu 00:00 / 01:00 UTC
--   final call        Thu 9:00am MT   → 15:00 / 16:00 UTC
--   deadline reveal   Thu 12:00pm MT  → 18:00 / 19:00 UTC (+5 min retry)
-- reveal-check (*/2 Tue–Thu UTC) already covers Thursday 18–19 UTC; unchanged.

select cron.unschedule('ante-slate-open');
select cron.schedule('ante-slate-open', '0 12,13 * * 2',
  $$select net.http_get('https://theantegame.com/api/jobs/slate-open', headers := ante_cron_headers())$$);

select cron.unschedule('ante-reminders');
select cron.schedule('ante-reminders', '0 0,1,15,16 * * 4',
  $$select net.http_get('https://theantegame.com/api/jobs/reminders', headers := ante_cron_headers())$$);

select cron.unschedule('ante-reveal-deadline');
select cron.schedule('ante-reveal-deadline', '0,5 18,19 * * 4',
  $$select net.http_get('https://theantegame.com/api/jobs/reveal-deadline', headers := ante_cron_headers())$$);
