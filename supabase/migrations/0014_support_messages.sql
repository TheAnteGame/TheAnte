-- 0014 — In-app support tickets.
--
-- The support box used to be a mailto: link, and the domain has no MX records, so
-- every message a player sent bounced. Support now stays on the platform: the player
-- opens a ticket here, the commissioner is emailed that one is waiting, and the reply
-- goes back out by email (D-012).
--
-- Nothing is ever deleted (rulebook §14): a ticket is answered, never removed.

create table support_messages (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id),
  body text not null,
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'answered')),
  reply text,
  answered_at timestamptz,
  answered_by uuid references players(id)
);

create index support_messages_open_idx on support_messages (status, created_at desc);

alter table support_messages enable row level security;

-- A player may open a ticket and read their own thread. Everything past that is the
-- commissioner's, service-role only, the same shape as app_settings (ANTE-TECH §4.3).
create policy support_insert_self on support_messages for insert to authenticated
  with check (player_id = ante.me() and ante.is_approved());

create policy support_read_self on support_messages for select to authenticated
  using (player_id = ante.me());
