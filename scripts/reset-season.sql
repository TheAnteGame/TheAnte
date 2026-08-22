-- ============================================================================
-- ANTE — PRE-LAUNCH SEASON RESET
-- Run in the Supabase SQL editor for project TheAnte (vyhxslqddjyyrgbmaedn).
--
-- WHAT THIS DOES
--   Returns the league to preseason with an empty ledger and one player: the
--   commissioner. Real players then apply through the normal flow, and Week 1
--   opens once the roster is closed.
--
-- WHY IT NEEDS TO DISABLE TRIGGERS
--   ledger_entries, audit_log, tickets, bets, mark_votes and chat_messages are
--   append-only BY DESIGN (0002_guards.sql) and their triggers raise for the
--   service role too. That is correct behaviour and must stay correct — so this
--   script disables them for the length of one transaction and re-enables them
--   before it commits. If any statement fails the whole thing rolls back and the
--   guards come back with it.
--
--   This is the ONLY situation where that is legitimate: nothing has been played
--   (0 tickets), so there is no history to protect. Do not reuse this script once
--   a real week has settled — corrections are new ledger entries, never deletes.
--
-- SAFETY
--   Wrapped in a single transaction. Read the verification block at the bottom
--   BEFORE you COMMIT. If anything looks wrong, ROLLBACK and nothing happened.
-- ============================================================================

begin;

-- Keep the commissioner's own row. Everything else goes.
create temporary table _keep on commit drop as
select player_id from commissioner;

-- Guard: refuse to run if the commissioner seat is missing or ambiguous. Without
-- this the script would happily delete every player and lock the console forever,
-- with no way back in through the UI.
do $$
declare n int;
begin
  select count(*) into n from _keep;
  if n <> 1 then
    raise exception 'ANTE RESET ABORTED: expected exactly one commissioner, found %', n;
  end if;
  if not exists (select 1 from players p join _keep k on k.player_id = p.id where p.status = 'approved') then
    raise exception 'ANTE RESET ABORTED: the commissioner is not an approved player';
  end if;
end $$;

-- ── Lift the append-only guards for this transaction ────────────────────────
alter table ledger_entries disable trigger ledger_append_only;
alter table audit_log      disable trigger audit_append_only;
alter table mark_votes     disable trigger mark_votes_append_only;
alter table chat_messages  disable trigger chat_no_delete;
alter table tickets        disable trigger tickets_immutable;
alter table bets           disable trigger bets_no_delete;
-- players_self_update_guard checks auth.jwt()->>'role' = 'service_role'. The SQL
-- editor carries NO jwt, so auth.jwt() is null and the guard treats you as a player
-- — which blocks the phone and shove_used_week writes below. Without this line the
-- transaction aborts partway.
alter table players        disable trigger players_self_update_guard;

-- ── Season play data — children first ───────────────────────────────────────
delete from bets;
delete from tickets;
delete from week_players;
delete from pot_awards;
delete from mark_votes;
delete from ledger_entries;
delete from games;
delete from weeks;
delete from league_snapshots;

-- ── Test residue on the shared surfaces ─────────────────────────────────────
-- Chat is seeded system messages about the test roster; the ticker is 60 synced
-- feed items. Both regenerate on their own.
delete from chat_messages;
delete from ticker_items;
delete from notification_log;
delete from support_messages;
delete from moderation_actions;
delete from audit_log;

-- ── The season, FIRST ──────────────────────────────────────────────────────────────
-- Back to preseason. week1_lock_at is cleared deliberately: while it is null the
-- app treats admission as OPEN (lib/player.ts rosterLocked), so people can join.
-- Set it when the roster closes — see the note under VERIFY.
-- Done before the app_settings update below: settings_rules_locked only raises
-- while a season is active, so standing the season down first keeps it inert.
update seasons
   set status         = 'preseason',
       current_week   = null,
       week1_lock_at  = null
 where year = 2026;

-- ── Break the remaining references to departing players ─────────────────────
-- These columns point at players but are not player data; null them rather than
-- delete the rows they sit on (settings, content and feed config all survive).
-- Derived from information_schema, not from reading the migrations: every FK column
-- that points at players and is NOT on a table wiped above. Miss one and the final
-- delete fails on a foreign-key violation.
update content_blocks    set updated_by = null where updated_by  not in (select player_id from _keep);
update content_revisions set created_by = null where created_by  not in (select player_id from _keep);
update app_settings      set updated_by = null where updated_by  not in (select player_id from _keep);
update players           set approved_by = null where approved_by not in (select player_id from _keep);

-- ── The roster ──────────────────────────────────────────────────────────────
-- The 7 test_seed_* accounts, plus Steven Morgan and bob Toler, who will re-apply
-- through the real onboarding flow.
delete from players where id not in (select player_id from _keep);

-- ── The commissioner's seat, restored to a clean preseason state ────────────
-- Chips are NOT credited here. approvePlayer() credits the 500 buy-in at approval
-- (ANTE-ADMIN §4.3), and this row is already approved — so its buy-in is inserted
-- explicitly below, once, to keep the ledger's story true: every chip in the league
-- entered as a buy_in.
update players
   set shove_used_week = null,
       phone           = '+16236958227'
 where id in (select player_id from _keep);

insert into ledger_entries (player_id, week_id, kind, amount, reason, idempotency_key)
select player_id, null, 'buy_in', 500, 'Buy-in — 2026 season', 'buy-in'
  from _keep;

-- ── Put the guards back BEFORE committing ───────────────────────────────────
alter table ledger_entries enable trigger ledger_append_only;
alter table audit_log      enable trigger audit_append_only;
alter table mark_votes     enable trigger mark_votes_append_only;
alter table chat_messages  enable trigger chat_no_delete;
alter table tickets        enable trigger tickets_immutable;
alter table bets           enable trigger bets_no_delete;
alter table players        enable trigger players_self_update_guard;

-- ============================================================================
-- VERIFY — read this output before you COMMIT.
--
-- Expect exactly:
--   players            1     (Robert Toler, approved)
--   commissioner_ok    t
--   ledger_rows        1     total_chips 500
--   weeks/games/tickets/week_players/bets    all 0
--   season             preseason, current_week null, week1_lock_at null
--   guards_enabled     7     ← all seven must be back ON
-- ============================================================================
select
  (select count(*) from players)                                as players,
  (select count(*) = 1 from players p join commissioner c on c.player_id = p.id
     where p.status = 'approved')                               as commissioner_ok,
  (select count(*) from ledger_entries)                         as ledger_rows,
  (select coalesce(sum(amount), 0) from ledger_entries)          as total_chips,
  (select count(*) from weeks)                                  as weeks,
  (select count(*) from games)                                  as games,
  (select count(*) from tickets)                                as tickets,
  (select count(*) from week_players)                           as week_players,
  (select count(*) from bets)                                   as bets,
  (select status from seasons where year = 2026)                as season_status,
  (select current_week from seasons where year = 2026)          as current_week,
  (select week1_lock_at from seasons where year = 2026)         as week1_lock_at,
  (select count(*) from pg_trigger
     where tgname in ('ledger_append_only','audit_append_only','mark_votes_append_only',
                      'chat_no_delete','tickets_immutable','bets_no_delete',
                      'players_self_update_guard')
       and tgenabled = 'O')                                     as guards_enabled;

-- If that row reads right:      COMMIT;
-- If ANYTHING looks wrong:      ROLLBACK;

-- ============================================================================
-- AFTER THE RESET — the order that matters
--
--   1. People apply at theantegame.com and you approve them. Each approval
--      credits 500 chips. Admission stays open while week1_lock_at is null.
--
--   2. When the roster is FINAL, set the season live and close admission:
--
--        update seasons
--           set status = 'active', week1_lock_at = '<the moment you close the door>'
--         where year = 2026;
--
--   3. ONLY THEN let the Week 1 slate open.
--
-- CORRECTION (D-034): late approvals are handled. admitToOpenWeek (lib/jobs/admit.ts)
-- runs on every approval and reactivation — a player approved while a week is open
-- and before its Thursday deadline is dealt straight in: same ante, a limit from the
-- week's frozen median, a live board. A player approved after the deadline simply
-- belongs to next week (no ante, no phantom fold). So the only ordering that matters
-- is: set the season active when you're ready for the cron (Tuesdays 10:00/11:00 UTC)
-- to start opening slates. Approvals can keep flowing while a week is open.
-- ============================================================================
