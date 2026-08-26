-- 0019 — Removal: the seat that never really sat down (D-041).
--
-- Deactivation (§13) is for a player who quit: they keep their chips and their line
-- in the standings, and the rulebook says out loud that nobody is ever deleted. That
-- is still true here. Removal is a strictly narrower thing for a beta roster — a seat
-- that never played, whose chips should go back to the table rather than sit frozen
-- all season. The player's ledger history is untouched and their audit trail stays;
-- only their VISIBILITY and their STACK change.
--
-- Why removal cannot be a delete, and never will be: the ledger is append-only, and
-- conservation reads stacks+pot == 500 × buy-ins. Dropping a player's rows removes
-- their buy-in (500) but also removes whatever they won FROM other players — chips
-- those players' stacks still reflect. The books would break by exactly the amount
-- the player was up or down. So removal is a transfer out, never a deletion.

alter table players drop constraint if exists players_status_check;
alter table players add constraint players_status_check
  check (status in ('pending', 'approved', 'rejected', 'deactivated', 'removed'));

alter table players add column if not exists removed_at timestamptz;
alter table players add column if not exists removal_reason text;

comment on column players.removed_at is
  'Set when the commissioner removed a seat from the beta roster (D-041). Their stack was redistributed to the remaining approved players; ledger history is retained. Distinct from deactivated_at, which keeps the stack and the standings row.';

-- The redistribution's own ledger kind, so the movement is legible in the books
-- rather than hiding inside a generic correction — D-023 was a correction that moved
-- ~8,000 chips unnoticed precisely because the kind said nothing.
alter table ledger_entries drop constraint if exists ledger_entries_kind_check;
alter table ledger_entries add constraint ledger_entries_kind_check
  check (kind in (
    'buy_in', 'ante', 'ante_refund', 'ante_recharge', 'bet_stake', 'bet_return',
    'bet_payout', 'sweep', 'pot_award', 'correction', 'reversal', 'marker',
    'felt_floor', 'season_close', 'removal'
  ));

-- The self-update guard predates this column set; a player must not be able to
-- un-remove themselves or forge a removal reason.
create or replace function guard_players_self_update() returns trigger
language plpgsql set search_path = public as $$
declare v_role text;
begin
  v_role := coalesce(auth.jwt()->>'role', '');
  if v_role <> '' and v_role <> 'service_role' then
    if new.status is distinct from old.status
       or new.clerk_user_id is distinct from old.clerk_user_id
       or new.phone is distinct from old.phone
       or new.is_muted is distinct from old.is_muted
       or new.muted_until is distinct from old.muted_until
       or new.shove_used_week is distinct from old.shove_used_week
       or new.applied_at is distinct from old.applied_at
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by
       or new.joined_at is distinct from old.joined_at
       or new.deactivated_at is distinct from old.deactivated_at
       or new.deactivation_reason is distinct from old.deactivation_reason
       or new.deactivation_evidence is distinct from old.deactivation_evidence
       or new.removed_at is distinct from old.removed_at
       or new.removal_reason is distinct from old.removal_reason
       or new.notes is distinct from old.notes then
      raise exception 'ANTE: players may edit only their own profile fields.';
    end if;
  end if;
  return new;
end $$;
