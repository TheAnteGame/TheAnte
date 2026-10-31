-- 0035 — Phone notifications keep their own hours (D-121).
--
-- Owner's call: no phone buzzes between 10pm and 9am league time, the week-open
-- push waits for 10am Tuesday, the final call's push lands at 9am Thursday, and one
-- more goes at 11am Thursday — to phones only. Every email keeps its time.
--
-- push_queue holds a push that was asked for during quiet hours (or before 10am
-- Tuesday) until the push.release job sends it. Same shape as push_subscriptions:
-- RLS on, no policies, service role only. log_id points at the notification_log row
-- written as 'held', which the release updates to what actually happened.
create table push_queue (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  log_id uuid references notification_log(id) on delete set null,
  log_key text not null,
  title text not null,
  body text not null,
  url text not null,
  deliver_after timestamptz not null,
  -- A reminder that stops mattering once the player has a ticket in this week.
  unless_ticket_week uuid references weeks(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index push_queue_due on push_queue (deliver_after);

alter table push_queue enable row level security;

comment on table push_queue is 'Phone notifications held by quiet hours (D-121). Service role only; drained by push.release.';

-- push.release: every five minutes. Outside quiet hours it sends what has come due;
-- inside them it does nothing.
select cron.schedule('ante-push-release', '*/5 * * * *',
  $$select net.http_get('https://theantegame.com/api/jobs/push-release', headers := ante_cron_headers())$$);

-- Thursday 11:00am Mountain -> 17:00 / 18:00 UTC across DST. The reminders job's own
-- clock guard picks the one-hour push at 11; the other hour lands on the final
-- call (deduped, so a no-op) or after noon (skipped).
select cron.schedule('ante-last-hour-thu', '0 17,18 * * 4',
  $$select net.http_get('https://theantegame.com/api/jobs/reminders', headers := ante_cron_headers())$$);
