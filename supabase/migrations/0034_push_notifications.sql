-- 0034 — Phone notifications by web push (D-120).
--
-- One row per device a player has switched notifications on for. The endpoint is
-- the push service's address for that one browser install, and holding it is
-- proof of the device: whoever presents it from a signed-in session owns the row,
-- so a phone handed to another player moves with them rather than failing.
--
-- RLS on, no policies — the same shape as notification_log. Players reach it only
-- through the profile server action, which re-checks the signed-in player before
-- writing with the service role; the senders and the admin roster read it the same
-- way. Not in the backup snapshot: endpoints are device state, not league data,
-- and a restored one would point at a browser that has long since forgotten it.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_subscriptions_player on push_subscriptions (player_id);

alter table push_subscriptions enable row level security;

comment on table push_subscriptions is 'Web push devices per player (D-120). Service role only; written by the profile toggle, pruned when the push service answers 404/410.';

-- Every push send is logged beside the email it mirrors. Widening the allowed
-- channels is exactly the change schema:check verifies through 0032 (D-110).
alter table notification_log drop constraint if exists notification_log_channel_check;
alter table notification_log add constraint notification_log_channel_check
  check (channel in ('sms', 'email', 'push'));
