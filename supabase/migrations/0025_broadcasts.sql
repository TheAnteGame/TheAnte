-- 0025 — One-off league emails from the console (D-088).
--
-- The scheduled funnel covers the season; this is for the commissioner's own word
-- to the whole league — an app update, an apology for a bug, a reminder outside the
-- calendar. Written in the console, wrapped in the same envelope as every other
-- email, sent now or at a chosen time. Service-role only: RLS on, no policies.

create table broadcasts (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (length(trim(subject)) > 0),
  headline text not null check (length(trim(headline)) > 0),
  eyebrow text not null default 'ANTE',
  body text not null check (length(trim(body)) > 0),
  cta_label text,
  cta_href text,
  send_at timestamptz not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'cancelled', 'failed')),
  sent_count int not null default 0,
  error text,
  created_by uuid references players(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index broadcasts_due on broadcasts (send_at) where status = 'queued';
alter table broadcasts enable row level security;

comment on table broadcasts is 'One-off league emails composed in the console (D-088). Sent by the broadcast.send job when send_at passes; each player is deduped in notification_log under broadcast:<id>.';

-- Every five minutes: anything queued whose time has come goes out.
select cron.schedule('ante-broadcast', '*/5 * * * *',
  $$select net.http_get('https://theantegame.com/api/jobs/broadcast', headers := ante_cron_headers())$$);
