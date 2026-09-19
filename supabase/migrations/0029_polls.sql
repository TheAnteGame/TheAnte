-- 0029 — League polls (D-095).
--
-- Commissioner-only polls that live in Table Talk and in the inbox. A vote is
-- always a player's (never anonymous in the record) but the room only ever sees
-- percentages; names are the commissioner's to see in the console. One vote per
-- player per poll, changeable until the poll closes. The polls.tick job (every five
-- minutes) mails the league when a poll opens and again six hours before it closes,
-- then marks it closed.

create table polls (
  id uuid primary key default gen_random_uuid(),
  question text not null check (length(trim(question)) > 0),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  opens_at timestamptz not null,
  closes_at timestamptz not null check (closes_at > opens_at),
  opened_notified_at timestamptz,
  reminder_notified_at timestamptz,
  closed_at timestamptz,
  created_by uuid references players(id),
  created_at timestamptz not null default now()
);
create index polls_live on polls (closes_at desc);

create table poll_votes (
  poll_id uuid not null references polls(id) on delete cascade,
  player_id uuid not null references players(id),
  option_index int not null check (option_index >= 0),
  via text not null default 'site' check (via in ('site', 'email')),
  voted_at timestamptz not null default now(),
  primary key (poll_id, player_id)
);

-- Service role only from the app side: the poll card reads through the server and
-- renders aggregates; a browser never queries these tables.
alter table polls enable row level security;
alter table poll_votes enable row level security;

comment on table polls is 'Commissioner polls (D-095): question, 2–6 options, open/close window, notification marks.';
comment on table poll_votes is 'One row per player per poll (D-095). Named in the record; the room sees percentages only.';

select cron.schedule('ante-polls', '*/5 * * * *',
  $$select net.http_get('https://theantegame.com/api/jobs/polls', headers := ante_cron_headers())$$);
