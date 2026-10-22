-- APPLY migration 0033 to production, with its own safety checks (D-117).
--
-- Written as ONE do-block on purpose (D-117). The Supabase SQL editor does not run a
-- pasted script as one transaction — each statement commits on its own, even after
-- BEGIN — so the first version of this script applied 0033 while its checks failed.
-- A do-block is a single statement: if it raises, every change inside it is undone,
-- in any editor. Run the whole file once.
--
-- It refuses unless the live rules are exactly the pre-0033 ones, counts what every
-- player and a stranger can see, applies 0033, counts again, and undoes everything on
-- a single difference. The last line reports what is actually live.

do $do$
declare
  v record; t text; n bigint; fp text; before text; tally text; checks int := 0;
  tbls text[] := array['app_settings','bets','chat_messages','commissioner','content_blocks','feed_items','feed_sources','games','ledger_entries','mark_votes','players','pot_awards','seasons','support_messages','teams','ticker_items','tickets','week_players','weeks','standings'];
begin
  select md5(string_agg(tablename||'|'||policyname||'|'||cmd||'|'||roles::text||'|'||coalesce(qual,'')||'|'||coalesce(with_check,''), E'\n' order by tablename, policyname)) from pg_policies where schemaname = 'public' into fp;
  if fp is distinct from '1381ee9270221258e4d3f7a810760117' then
    raise exception 'STOPPED: the live rules are not the expected ones (fingerprint %). Nothing was changed.', fp;
  end if;
  -- what every player (and a stranger) can see, as one fingerprint
  tally := '';
  for v in (select clerk_user_id as sub, status from players union all select 'nobody-unknown', 'stranger' order by 1) loop
    foreach t in array tbls loop
      perform set_config('request.jwt.claims', json_build_object('sub', v.sub, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      execute format('select count(*) from public.%I', t) into n;
      execute 'reset role';
      tally := tally || v.sub || '|' || t || '|' || n || E'\n';
      checks := checks + 1;
    end loop;
  end loop;
  before := tally; checks := 0;
  execute $q$alter policy app_settings_read on public.app_settings
  using ((select ante.is_approved()))$q$;
  execute $q$alter policy bets_blackout on public.bets
  using ((EXISTS ( SELECT 1
   FROM tickets t
  WHERE ((t.id = bets.ticket_id) AND ((t.player_id = (select ante.me())) OR ((select ante.is_approved()) AND (EXISTS ( SELECT 1
           FROM weeks w
          WHERE ((w.id = t.week_id) AND (w.revealed_at IS NOT NULL))))))))))$q$;
  execute $q$alter policy bets_submit on public.bets
  with check ((EXISTS ( SELECT 1
   FROM (tickets t
     JOIN weeks w ON ((w.id = t.week_id)))
  WHERE ((t.id = bets.ticket_id) AND (t.player_id = (select ante.me())) AND (w.phase = 'open'::text) AND (now() < w.deadline_at)))))$q$;
  execute $q$alter policy chat_post on public.chat_messages
  with check (((player_id = (select ante.me())) AND (select ante.is_approved()) AND (is_system = false) AND (hidden_at IS NULL) AND (hidden_by IS NULL) AND (hidden_reason IS NULL) AND (NOT (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.id = (select ante.me())) AND (p.is_muted AND ((p.muted_until IS NULL) OR (p.muted_until > now())))))))))$q$;
  execute $q$alter policy chat_read on public.chat_messages
  using ((select ante.is_approved()))$q$;
  execute $q$alter policy commissioner_read on public.commissioner
  using ((select ante.is_approved()))$q$;
  execute $q$alter policy feed_items_read on public.feed_items
  using (((select ante.is_approved()) AND (hidden = false)))$q$;
  execute $q$alter policy feed_sources_read on public.feed_sources
  using ((select ante.is_approved()))$q$;
  execute $q$alter policy games_read on public.games
  using ((select ante.is_approved()))$q$;
  execute $q$alter policy ledger_read on public.ledger_entries
  using ((select ante.is_approved()))$q$;
  execute $q$alter policy mark_vote on public.mark_votes
  with check (((voter_player_id = (select ante.me())) AND (select ante.is_approved())))$q$;
  execute $q$alter policy mark_votes_read on public.mark_votes
  using ((select ante.is_approved()))$q$;
  execute $q$alter policy players_apply on public.players
  with check (((clerk_user_id = ((select auth.jwt()) ->> 'sub'::text)) AND (status = 'pending'::text)))$q$;
  execute $q$alter policy players_read on public.players
  using (((clerk_user_id = ((select auth.jwt()) ->> 'sub'::text)) OR (select ante.is_approved())))$q$;
  execute $q$alter policy players_self_update on public.players
  using ((clerk_user_id = ((select auth.jwt()) ->> 'sub'::text)))
  with check ((clerk_user_id = ((select auth.jwt()) ->> 'sub'::text)))$q$;
  execute $q$alter policy pot_awards_read on public.pot_awards
  using ((select ante.is_approved()))$q$;
  execute $q$alter policy seasons_read on public.seasons
  using ((select ante.is_approved()))$q$;
  execute $q$alter policy support_insert_self on public.support_messages
  with check (((player_id = (select ante.me())) AND (select ante.is_approved())))$q$;
  execute $q$alter policy support_read_self on public.support_messages
  using ((player_id = (select ante.me())))$q$;
  execute $q$alter policy ticker_read on public.ticker_items
  using (((select ante.is_approved()) AND (hidden = false)))$q$;
  execute $q$alter policy tickets_blackout on public.tickets
  using (((player_id = (select ante.me())) OR ((select ante.is_approved()) AND (EXISTS ( SELECT 1
   FROM weeks w
  WHERE ((w.id = tickets.week_id) AND (w.revealed_at IS NOT NULL)))))))$q$;
  execute $q$alter policy tickets_submit on public.tickets
  with check (((player_id = (select ante.me())) AND (select ante.is_approved()) AND (is_fold = false) AND (EXISTS ( SELECT 1
   FROM weeks w
  WHERE ((w.id = tickets.week_id) AND (w.phase = 'open'::text) AND (now() >= w.opens_at) AND (now() < w.deadline_at))))))$q$;
  execute $q$alter policy week_players_read on public.week_players
  using ((select ante.is_approved()))$q$;
  execute $q$alter policy weeks_read on public.weeks
  using ((select ante.is_approved()))$q$;
  -- what every player (and a stranger) can see, as one fingerprint
  tally := '';
  for v in (select clerk_user_id as sub, status from players union all select 'nobody-unknown', 'stranger' order by 1) loop
    foreach t in array tbls loop
      perform set_config('request.jwt.claims', json_build_object('sub', v.sub, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
      execute format('select count(*) from public.%I', t) into n;
      execute 'reset role';
      tally := tally || v.sub || '|' || t || '|' || n || E'\n';
      checks := checks + 1;
    end loop;
  end loop;
  if tally is distinct from before then
    raise exception 'STOPPED: what players can see would change. Everything was undone; nothing was applied.';
  end if;
  select md5(string_agg(tablename||'|'||policyname||'|'||cmd||'|'||roles::text||'|'||coalesce(qual,'')||'|'||coalesce(with_check,''), E'\n' order by tablename, policyname)) from pg_policies where schemaname = 'public' into fp;
  if fp is distinct from '6af2f84282d70f4313e486700471dde4' then
    raise exception 'STOPPED: the result is not the verified rule set (fingerprint %). Nothing was applied.', fp;
  end if;
  raise notice '0033 applied: % checks, 0 differences', checks;
end
$do$;

-- What is ACTUALLY live, whatever happened above:
select case md5(string_agg(tablename||'|'||policyname||'|'||cmd||'|'||roles::text||'|'||coalesce(qual,'')||'|'||coalesce(with_check,''), E'\n' order by tablename, policyname))
         when '6af2f84282d70f4313e486700471dde4' then '0033 is APPLIED (rules match the verified fix)'
         when '1381ee9270221258e4d3f7a810760117' then '0033 is NOT APPLIED (original rules live)'
         else 'UNEXPECTED rules — do not continue; tell Claude' end as result
  from pg_policies where schemaname = 'public';
