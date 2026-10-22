-- 0033 — Security rules evaluated once per query, not once per row (D-117).
--
-- Every policy called ante.is_approved() / ante.me() / auth.jwt() bare, so Postgres
-- re-ran each one FOR EVERY ROW it checked — and is_approved() is itself a lookup on
-- players. The standings view took 0.9 s for 14 rows in production (2026-10-22);
-- across the season the database spent ~41 hours on queries like it, which is why
-- signed-in pages took several seconds. Wrapped in (select ...), each becomes an
-- InitPlan: computed once per statement and reused. The functions are STABLE, so
-- the result is identical for every row of a statement — same rows visible, same
-- blackout, same writes allowed. Only the cost changes (local: 60 ms -> 3.9 ms).
--
-- Generated from the live policy text (production and the migration chain had the
-- same fingerprint, 1381ee92…). 24 of 26 policies change; the rest never
-- called these functions. Undo: docs/rollbacks/0033_restore_policies.sql restores
-- every one of them word for word.

alter policy app_settings_read on public.app_settings
  using ((select ante.is_approved()));

alter policy bets_blackout on public.bets
  using ((EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = bets.ticket_id) AND ((t.player_id = (select ante.me())) OR ((select ante.is_approved()) AND (EXISTS ( SELECT 1
           FROM weeks w
          WHERE ((w.id = t.week_id) AND (w.revealed_at IS NOT NULL))))))))));

alter policy bets_submit on public.bets
  with check ((EXISTS ( SELECT 1
   FROM (tickets t
     JOIN weeks w ON ((w.id = t.week_id)))
  WHERE ((t.id = bets.ticket_id) AND (t.player_id = (select ante.me())) AND (w.phase = 'open'::text) AND (now() < w.deadline_at)))));

alter policy chat_post on public.chat_messages
  with check (((player_id = (select ante.me())) AND (select ante.is_approved()) AND (is_system = false) AND (hidden_at IS NULL) AND (hidden_by IS NULL) AND (hidden_reason IS NULL) AND (NOT (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = (select ante.me())) AND (p.is_muted AND ((p.muted_until IS NULL) OR (p.muted_until > now())))))))));

alter policy chat_read on public.chat_messages
  using ((select ante.is_approved()));

alter policy commissioner_read on public.commissioner
  using ((select ante.is_approved()));

alter policy feed_items_read on public.feed_items
  using (((select ante.is_approved()) AND (hidden = false)));

alter policy feed_sources_read on public.feed_sources
  using ((select ante.is_approved()));

alter policy games_read on public.games
  using ((select ante.is_approved()));

alter policy ledger_read on public.ledger_entries
  using ((select ante.is_approved()));

alter policy mark_vote on public.mark_votes
  with check (((voter_player_id = (select ante.me())) AND (select ante.is_approved())));

alter policy mark_votes_read on public.mark_votes
  using ((select ante.is_approved()));

alter policy players_apply on public.players
  with check (((clerk_user_id = ((select auth.jwt()) ->> 'sub'::text)) AND (status = 'pending'::text)));

alter policy players_read on public.players
  using (((clerk_user_id = ((select auth.jwt()) ->> 'sub'::text)) OR (select ante.is_approved())));

alter policy players_self_update on public.players
  using ((clerk_user_id = ((select auth.jwt()) ->> 'sub'::text)))
  with check ((clerk_user_id = ((select auth.jwt()) ->> 'sub'::text)));

alter policy pot_awards_read on public.pot_awards
  using ((select ante.is_approved()));

alter policy seasons_read on public.seasons
  using ((select ante.is_approved()));

alter policy support_insert_self on public.support_messages
  with check (((player_id = (select ante.me())) AND (select ante.is_approved())));

alter policy support_read_self on public.support_messages
  using ((player_id = (select ante.me())));

alter policy ticker_read on public.ticker_items
  using (((select ante.is_approved()) AND (hidden = false)));

alter policy tickets_blackout on public.tickets
  using (((player_id = (select ante.me())) OR ((select ante.is_approved()) AND (EXISTS ( SELECT 1
   FROM weeks w
  WHERE ((w.id = tickets.week_id) AND (w.revealed_at IS NOT NULL)))))));

alter policy tickets_submit on public.tickets
  with check (((player_id = (select ante.me())) AND (select ante.is_approved()) AND (is_fold = false) AND (EXISTS ( SELECT 1
   FROM weeks w
  WHERE ((w.id = tickets.week_id) AND (w.phase = 'open'::text) AND (now() >= w.opens_at) AND (now() < w.deadline_at))))));

alter policy week_players_read on public.week_players
  using ((select ante.is_approved()));

alter policy weeks_read on public.weeks
  using ((select ante.is_approved()));
