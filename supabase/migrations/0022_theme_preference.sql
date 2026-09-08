-- 0022 — A per-player screen-mode preference (owner request): auto (system), light,
-- or dark. Self-editable like how_to_play_accepted_at (D-024) — the players
-- self-update guard is a denylist, and theme_preference is not on it, so no trigger
-- change is needed for a player to set their own.
alter table players
  add column theme_preference text not null default 'auto'
  check (theme_preference in ('auto', 'light', 'dark'));
