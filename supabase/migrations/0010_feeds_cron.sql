-- 0010 — feeds.sync every 15 minutes (ANTE-ADMIN §5), same pattern as 0006.
select cron.schedule('ante-feeds-sync', '*/15 * * * *',
  $$select net.http_get('https://theantegame.com/api/jobs/feeds-sync', headers := ante_cron_headers())$$);
