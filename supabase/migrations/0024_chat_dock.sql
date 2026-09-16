-- D-086: Table Talk becomes a docked strip. Two player-owned columns:
--   chat_read_at   — when this player last had the room open; unread = messages
--                    after it, by other players. Null = never opened the dock.
--   chat_position  — where the dock sits: corner (bottom-right, the default), bar
--                    (full-width strip along the bottom), side (right-edge tab).
-- Both are self-editable by the existing denylist guard (guard_players_self_update):
-- neither is on the list, so no trigger change, same shape as theme_preference (0022).
alter table players
  add column chat_read_at timestamptz,
  add column chat_position text not null default 'corner'
    check (chat_position in ('corner', 'bar', 'side'));

comment on column players.chat_read_at is 'Last time the player had Table Talk open (D-086). Unread = messages after this by others.';
comment on column players.chat_position is 'Where the Table Talk dock sits: corner | bar | side (D-086). Chosen on /profile.';
