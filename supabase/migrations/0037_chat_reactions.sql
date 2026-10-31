-- 0037 — Reactions on Table Talk messages (D-123).
--
-- One per player per message (the primary key): picking another swaps it, picking
-- the same one again deletes it. Stored as a kind, not the emoji, so the allowed
-- list below is plain text that schema:check can compare.
--
-- Approved players read them (names are public, rulebook §11 — the blackout covers
-- picks, not chat). Nobody writes through the API: the react server action checks
-- the seat, the mute and the message, then writes with the service role — the same
-- shape as poll_votes.
create table chat_reactions (
  message_id uuid not null references chat_messages(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  kind text not null check (kind in ('like', 'love', 'laugh', 'fire', 'dislike')),
  created_at timestamptz not null default now(),
  primary key (message_id, player_id)
);

alter table chat_reactions enable row level security;

create policy chat_reactions_read on chat_reactions for select to authenticated using ((select ante.is_approved()));

comment on table chat_reactions is 'Table Talk reactions (D-123). One per player per message; written only by the react server action.';
