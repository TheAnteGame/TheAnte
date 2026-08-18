-- 0008 — The players self-update guard only recognized the service role's JWT and
-- rejected direct administrative SQL (no JWT at all), which blocked the
-- commissioner bootstrap. Roster-state writes are allowed when there is no user
-- JWT (direct/admin access) or when the role is service_role; an authenticated
-- player remains confined to their own profile fields.

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
       or new.notes is distinct from old.notes then
      raise exception 'ANTE: players may edit only their own profile fields.';
    end if;
  end if;
  return new;
end $$;
