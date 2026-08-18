-- 0011 — reminder (Wed 6pm ET) and final call (Thu 9am ET) sends, unsubmitted only.
-- Both possible UTC hours per DST side; the job guards in ET and dedupes via
-- notification_log, so extra firings are no-ops.
select cron.schedule('ante-reminders', '0 13,14,22,23 * * 3,4',
  $$select net.http_get('https://theantegame.com/api/jobs/reminders', headers := ante_cron_headers())$$);
