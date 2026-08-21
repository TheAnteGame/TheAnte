-- 0017 — Daily backup nag (D-017).
--
-- The org is on Supabase's free plan: no automated backups. The commissioner's
-- downloaded file is the only copy that survives losing the project, so the job runs
-- every day and emails until they confirm they have one. It goes quiet on its own
-- once "I've got the file" is pressed and stays quiet until the next one is due.
--
-- 13:00 UTC is 9am ET in summer, 8am in winter — either is a fine hour to be nagged.

select cron.schedule('ante-backup-reminder', '0 13 * * *',
  $$select net.http_get('https://theantegame.com/api/jobs/backup-reminder', headers := ante_cron_headers())$$);
