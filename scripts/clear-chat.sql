-- ============================================================================
-- ANTE — clear the automated Table Talk announcements (D-038)
-- Run in the Supabase SQL editor for TheAnte, WITHOUT RLS.
--
-- The code no longer posts these, but four already sit in the room. chat_messages
-- is delete-guarded (0002_guards.sql chat_no_delete) — hiding them would leave
-- tombstones taking the same space, so the guard comes off for one transaction.
--
-- Player conversation is untouched: this deletes ONLY system messages (is_system),
-- and only the three announcement kinds the owner asked to retire.
-- ============================================================================

begin;

alter table chat_messages disable trigger chat_no_delete;

delete from chat_messages
 where is_system
   and (   body like 'The 2026 season is live%'
        or body like 'The Week % board is open%'
        or body like '% has a seat. 500 chips%');

alter table chat_messages enable trigger chat_no_delete;

-- Expect: system_left 0 (or only genuine notices), player messages untouched,
-- guard_enabled t.
select
  (select count(*) from chat_messages where is_system)        as system_messages_left,
  (select count(*) from chat_messages where not is_system)    as player_messages,
  (select tgenabled = 'O' from pg_trigger
     where tgname = 'chat_no_delete')                          as guard_enabled;

commit;
