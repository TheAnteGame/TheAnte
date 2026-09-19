-- 0028 — Reminders at Wednesday noon and Thursday 6am MST (D-092).
--
-- The Wednesday-evening reminder landed at 8pm Eastern, which helps nobody, and
-- the Thursday 9am final call was three hours from the wall. Owner's call: the
-- reminder goes at noon Wednesday — exactly 24 hours before the wall, mid-afternoon
-- back East, late morning on the coast — and the final call at 6am Thursday, the
-- same hour the Tuesday opener already lands. Two cron entries, one job: the job's
-- own guard (lib/jobs/reminders.ts) picks the template from the local clock, so a
-- DST double-hour is harmless as it always was.
--
--   ante-reminder-wed     Wed 12:00 MST -> 18:00 / 19:00 UTC
--   ante-final-call-thu   Thu  6:00 MST -> 12:00 / 13:00 UTC

select cron.unschedule('ante-reminders');
select cron.schedule('ante-reminder-wed', '0 18,19 * * 3',
  $$select net.http_get('https://theantegame.com/api/jobs/reminders', headers := ante_cron_headers())$$);
select cron.schedule('ante-final-call-thu', '0 12,13 * * 4',
  $$select net.http_get('https://theantegame.com/api/jobs/reminders', headers := ante_cron_headers())$$);
