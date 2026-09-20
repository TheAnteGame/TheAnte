-- 0031 — A player may pin the news box to one source (D-099).
--
-- Null (the default) means every source that carries their team, rotated so no one
-- feed owns the box. Self-editable by the existing denylist guard — this column is
-- not on the list — the same shape as theme_preference (0022) and chat_position
-- (0024). ON DELETE SET NULL so removing a source in the console cannot strand a
-- player on a feed that no longer exists.
alter table players
  add column news_source_id uuid references feed_sources(id) on delete set null;

comment on column players.news_source_id is 'Pinned news source for the dashboard box (D-099). Null = all sources for their team, rotated.';
