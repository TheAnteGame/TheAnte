-- APPLY migration 0033 to production, with its own safety checks (D-117).
--
-- Paste the whole thing into the Supabase SQL editor and run it once. It is ONE
-- transaction and it can only commit if the change is invisible to every player:
--   1. the live security rules must be exactly the ones 0033 was built from, or it
--      stops before changing anything;
--   2. it counts what every player (and a stranger) can see in every table;
--   3. it applies 0033;
--   4. it counts again — if a single count differs, it raises and EVERYTHING rolls
--      back, so nothing is applied.
-- The last line always reports what is actually live: APPLIED or NOT APPLIED. Undo with
-- docs/rollbacks/0033_restore_policies.sql.

begin;

do $$
declare fp text;
begin
  select md5(string_agg(tablename||'|'||policyname||'|'||cmd||'|'||roles::text||'|'||coalesce(qual,'')||'|'||coalesce(with_check,''), E'\n' order by tablename, policyname))
    into fp from pg_policies where schemaname = 'public';
  if fp is distinct from '1381ee9270221258e4d3f7a810760117' then
    raise exception 'STOPPED: the live rules are not the ones 0033 was built from (fingerprint %). Nothing was changed.', fp;
  end if;
end $$;

create temp table vis_before (viewer text, tbl text, n bigint) on commit drop;
create temp table vis_after (viewer text, tbl text, n bigint) on commit drop;

do $$
declare v record; t text; n bigint;
  tbls text[] := array['app_settings','bets','chat_messages','commissioner','content_blocks','feed_items','feed_sources','games','ledger_entries','mark_votes','players','pot_awards','seasons','support_messages','teams','ticker_items','tickets','week_players','weeks','standings'];
begin
  for v in (select clerk_user_id as sub, status from players union all select 'nobody-unknown', 'stranger') loop
    foreach t in array tbls loop
      perform set_config('request.jwt.claims', json_build_object('sub', v.sub, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      execute format('select count(*) from public.%I', t) into n;
      execute 'reset role';
      insert into vis_before values (v.status || ':' || v.sub, t, n);
    end loop;
  end loop;
end $$;

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

do $$
declare v record; t text; n bigint;
  tbls text[] := array['app_settings','bets','chat_messages','commissioner','content_blocks','feed_items','feed_sources','games','ledger_entries','mark_votes','players','pot_awards','seasons','support_messages','teams','ticker_items','tickets','week_players','weeks','standings'];
begin
  for v in (select clerk_user_id as sub, status from players union all select 'nobody-unknown', 'stranger') loop
    foreach t in array tbls loop
      perform set_config('request.jwt.claims', json_build_object('sub', v.sub, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      execute format('select count(*) from public.%I', t) into n;
      execute 'reset role';
      insert into vis_after values (v.status || ':' || v.sub, t, n);
    end loop;
  end loop;
end $$;

do $$
declare checks int; diffs int;
begin
  select count(*), count(*) filter (where a.n is distinct from b.n) into checks, diffs
    from vis_before b full join vis_after a using (viewer, tbl);
  if diffs > 0 or checks = 0 then
    raise exception 'STOPPED: % of % visibility checks changed. Everything rolled back; nothing was applied.', diffs, checks;
  end if;
  raise notice '0033 applied: % checks, 0 differences', checks;
end $$;

commit;

-- What is ACTUALLY live, whatever happened above: a stopped run says NOT APPLIED.
select case md5(string_agg(tablename||'|'||policyname||'|'||cmd||'|'||roles::text||'|'||coalesce(qual,'')||'|'||coalesce(with_check,''), E'\n' order by tablename, policyname))
         when '6af2f84282d70f4313e486700471dde4' then '0033 is APPLIED (rules match the verified fix)'
         when '1381ee9270221258e4d3f7a810760117' then '0033 is NOT APPLIED (original rules still live)'
         else 'UNEXPECTED rules — do not continue; tell Claude' end as result
  from pg_policies where schemaname = 'public';
