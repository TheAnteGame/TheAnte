-- 0012 — How-to-play tutorial gate. A player must click through the interactive
-- tutorial once before their first /dashboard visit. Nullable, no default: null
-- means not yet accepted, same convention as approved_at/joined_at/deactivated_at.

alter table players add column how_to_play_accepted_at timestamptz;

comment on column players.how_to_play_accepted_at is
  'Set once by the player via acceptHowToPlay() on their first /how-to-play visit. '
  'NULL means not yet seen. Self-editable: not in the guard_players_self_update() denylist.';
