-- 0021 — The news could never say where it came from (D-052).
--
-- 0003 enabled row level security on feed_sources and then never wrote a policy for
-- it. Postgres RLS denies by default, so an authenticated player reads ZERO rows from
-- that table — and because NewsBox pulls the attribution through an embedded join,
-- `feed_sources(name)` came back null for every item. The "Source: ..." line under
-- each headline has therefore never rendered for a single player since launch. The
-- data was always fine; the door was locked.
--
-- Every other league-readable table got this treatment in 0003 (seasons, weeks, games,
-- ledger_entries, pot_awards, chat_messages, ticker_items, feed_items, mark_votes).
-- feed_sources is the one that was missed. Same shape as feed_items_read, minus the
-- hidden check, which lives on the item rather than the source.

-- Row policy only, matching the nine tables above it. Considered and rejected:
-- scoping columns so players see just `name`. The remaining columns are the feed's
-- public RSS url and operational metadata (enabled, priority, last_fetched_at,
-- last_status, last_error) — no credentials, nothing a player could misuse — and
-- column grants would mean fighting Supabase's default table privileges for a table
-- whose sibling, feed_items, is already fully readable. Consistency wins here.
--
-- NOT filtered on `enabled`: a source switched off later must still be able to
-- attribute the stories it already published, or old headlines lose their byline.
create policy feed_sources_read on feed_sources for select to authenticated
  using (ante.is_approved());

comment on table feed_sources is
  'News feeds. Readable by approved players so a headline can be attributed to whoever wrote it (D-052); enabled but policy-less from 0003 until 0021, which silently blanked every source line.';
