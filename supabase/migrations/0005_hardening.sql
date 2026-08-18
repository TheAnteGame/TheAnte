-- 0005 — Advisor hardening. standings and active_player_count run as the requester
-- (their sources are approved-readable already, so invoker rights lose nothing).
-- waiting_on deliberately KEEPS owner rights: it must see ticket existence pre-reveal
-- to compute the submitted boolean — it is the narrow view ANTE-PLAYER §9 mandates,
-- exposes names and a boolean only, and is the single reviewed exception.

alter view standings set (security_invoker = true);
alter view active_player_count set (security_invoker = true);

-- Pin search_path on every trigger/guard function (advisor 0011).
alter function guard_tickets_immutable() set search_path = public;
alter function guard_bets_update() set search_path = public;
alter function guard_bets_delete() set search_path = public;
alter function guard_bets_insert() set search_path = public;
alter function guard_append_only() set search_path = public;
alter function guard_chat_update() set search_path = public;
alter function guard_settings_locked() set search_path = public;
alter function guard_players_self_update() set search_path = public;
