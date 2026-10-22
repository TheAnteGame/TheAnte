-- UNDO for migration 0033 (D-117). Restores every security rule 0033 touched to its
-- exact text before 0033, as captured from production on 2026-10-22 (fingerprint
-- 1381ee9270221258e4d3f7a810760117 — verify with the query at the bottom).
-- Paste into the Supabase SQL editor. Safe to run more than once.

alter policy app_settings_read on public.app_settings
  using (ante.is_approved());

alter policy bets_blackout on public.bets
  using ((EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = bets.ticket_id) AND ((t.player_id = ante.me()) OR (ante.is_approved() AND (EXISTS ( SELECT 1
           FROM weeks w
          WHERE ((w.id = t.week_id) AND (w.revealed_at IS NOT NULL))))))))));

alter policy bets_submit on public.bets
  with check ((EXISTS ( SELECT 1
   FROM (tickets t
     JOIN weeks w ON ((w.id = t.week_id)))
  WHERE ((t.id = bets.ticket_id) AND (t.player_id = ante.me()) AND (w.phase = 'open'::text) AND (now() < w.deadline_at)))));

alter policy chat_post on public.chat_messages
  with check (((player_id = ante.me()) AND ante.is_approved() AND (is_system = false) AND (hidden_at IS NULL) AND (hidden_by IS NULL) AND (hidden_reason IS NULL) AND (NOT (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = ante.me()) AND (p.is_muted AND ((p.muted_until IS NULL) OR (p.muted_until > now())))))))));

alter policy chat_read on public.chat_messages
  using (ante.is_approved());

alter policy commissioner_read on public.commissioner
  using (ante.is_approved());

alter policy feed_items_read on public.feed_items
  using ((ante.is_approved() AND (hidden = false)));

alter policy feed_sources_read on public.feed_sources
  using (ante.is_approved());

alter policy games_read on public.games
  using (ante.is_approved());

alter policy ledger_read on public.ledger_entries
  using (ante.is_approved());

alter policy mark_vote on public.mark_votes
  with check (((voter_player_id = ante.me()) AND ante.is_approved()));

alter policy mark_votes_read on public.mark_votes
  using (ante.is_approved());

alter policy players_apply on public.players
  with check (((clerk_user_id = (auth.jwt() ->> 'sub'::text)) AND (status = 'pending'::text)));

alter policy players_read on public.players
  using (((clerk_user_id = (auth.jwt() ->> 'sub'::text)) OR ante.is_approved()));

alter policy players_self_update on public.players
  using ((clerk_user_id = (auth.jwt() ->> 'sub'::text)))
  with check ((clerk_user_id = (auth.jwt() ->> 'sub'::text)));

alter policy pot_awards_read on public.pot_awards
  using (ante.is_approved());

alter policy seasons_read on public.seasons
  using (ante.is_approved());

alter policy support_insert_self on public.support_messages
  with check (((player_id = ante.me()) AND ante.is_approved()));

alter policy support_read_self on public.support_messages
  using ((player_id = ante.me()));

alter policy ticker_read on public.ticker_items
  using ((ante.is_approved() AND (hidden = false)));

alter policy tickets_blackout on public.tickets
  using (((player_id = ante.me()) OR (ante.is_approved() AND (EXISTS ( SELECT 1
   FROM weeks w
  WHERE ((w.id = tickets.week_id) AND (w.revealed_at IS NOT NULL)))))));

alter policy tickets_submit on public.tickets
  with check (((player_id = ante.me()) AND ante.is_approved() AND (is_fold = false) AND (EXISTS ( SELECT 1
   FROM weeks w
  WHERE ((w.id = tickets.week_id) AND (w.phase = 'open'::text) AND (now() >= w.opens_at) AND (now() < w.deadline_at))))));

alter policy week_players_read on public.week_players
  using (ante.is_approved());

alter policy weeks_read on public.weeks
  using (ante.is_approved());

-- What is ACTUALLY live after running this:
select case md5(string_agg(tablename||'|'||policyname||'|'||cmd||'|'||roles::text||'|'||coalesce(qual,'')||'|'||coalesce(with_check,''), E'\n' order by tablename, policyname))
         when '1381ee9270221258e4d3f7a810760117' then 'RESTORED: the original rules are live again'
         when '6af2f84282d70f4313e486700471dde4' then '0033 is still applied — the undo did not run'
         else 'UNEXPECTED rules — tell Claude' end as result
  from pg_policies where schemaname = 'public';
