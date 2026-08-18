-- 0002 — The guards. Postgres does the enforcing, not the application (ANTE-TECH §4.1).
-- Every trigger here fires for the service role too — that is the point. A bug in the
-- app must not be able to mutate a locked ticket or rewrite the ledger.

-- ── Ticket immutability (§13: "Touch a submitted ticket — never") ──────────────
-- There is no draft state: a ticket row exists only once submitted, so every UPDATE
-- and DELETE raises. Auto-folds are fresh INSERTs by the reveal job.
create or replace function guard_tickets_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'ANTE: tickets are immutable after submission (rulebook §13). No update, no delete, no exceptions.';
end $$;

create trigger tickets_immutable
  before update or delete on tickets
  for each row execute function guard_tickets_immutable();

-- ── Bets: picks immutable; only settlement outputs may be written ──────────────
-- Settlement and re-settlement write multiplier/result/payout. The pick itself —
-- game, side, chips, parent — can never change, and rows can never be deleted.
create or replace function guard_bets_update() returns trigger
language plpgsql as $$
begin
  if new.ticket_id is distinct from old.ticket_id
     or new.game_id  is distinct from old.game_id
     or new.side     is distinct from old.side
     or new.chips    is distinct from old.chips then
    raise exception 'ANTE: a locked bet''s pick cannot change (rulebook §13). Only settlement outputs are writable.';
  end if;
  return new;
end $$;

create trigger bets_pick_immutable
  before update on bets
  for each row execute function guard_bets_update();

create or replace function guard_bets_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'ANTE: bets are never deleted (rulebook §13). Voids settle as returned, they do not disappear.';
end $$;

create trigger bets_no_delete
  before delete on bets
  for each row execute function guard_bets_delete();

-- Bets may only be inserted in the same transaction that inserted their ticket —
-- submission is atomic, and nothing can append a bet to a locked ticket afterward.
create or replace function guard_bets_insert() returns trigger
language plpgsql as $$
declare v_same_xact boolean;
begin
  select age(t.xmin) = 0 into v_same_xact from tickets t where t.id = new.ticket_id;
  if v_same_xact is distinct from true then
    raise exception 'ANTE: bets can only be written with their ticket, at submission (rulebook §13).';
  end if;
  return new;
end $$;

create trigger bets_with_ticket_only
  before insert on bets
  for each row execute function guard_bets_insert();

-- ── Append-only tables: the ledger, the audit log, chat, mark votes ────────────
create or replace function guard_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'ANTE: % is append-only. Corrections are new entries, never edits (rulebook §13).', tg_table_name;
end $$;

create trigger ledger_append_only
  before update or delete on ledger_entries
  for each row execute function guard_append_only();

create trigger audit_append_only
  before update or delete on audit_log
  for each row execute function guard_append_only();

create trigger mark_votes_append_only
  before update or delete on mark_votes
  for each row execute function guard_append_only();

-- Chat is soft-delete only: hiding sets hidden_*; the body and the row survive.
create or replace function guard_chat_update() returns trigger
language plpgsql as $$
begin
  if new.body is distinct from old.body
     or new.player_id is distinct from old.player_id
     or new.is_system is distinct from old.is_system
     or new.created_at is distinct from old.created_at then
    raise exception 'ANTE: chat messages cannot be edited, only hidden (ANTE-ADMIN §4.3).';
  end if;
  return new;
end $$;

create trigger chat_hide_only
  before update on chat_messages
  for each row execute function guard_chat_update();

create trigger chat_no_delete
  before delete on chat_messages
  for each row execute function guard_append_only();

-- ── Rule constants and deadlines lock while a season is active (§13) ───────────
create or replace function guard_settings_locked() returns trigger
language plpgsql as $$
declare v_active boolean;
begin
  select exists(select 1 from seasons where status = 'active') into v_active;
  if v_active and coalesce(new.key, old.key) like 'rules.%' then
    raise exception 'ANTE: rule constants are locked while a season is active (rulebook §13). Offseason only.';
  end if;
  return coalesce(new, old);
end $$;

create trigger settings_rules_locked
  before insert or update or delete on app_settings
  for each row execute function guard_settings_locked();
