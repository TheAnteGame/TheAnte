-- 0018 — waiting_on lists only DEALT-IN players (D-034).
--
-- "Waiting on" means the room cannot open until this person submits. That set is the
-- players with a week_players snapshot (slate open, or late admission per D-020) —
-- not everyone approved: a player approved between the Thursday deadline and the
-- reveal belongs to NEXT week, and showing them as holding this one up on the ticker
-- would be false. Matches the same scoping in the reveal jobs.

create or replace view waiting_on with (security_barrier) as
  select p.first_name, p.last_name, (t.id is not null) as submitted
  from weeks w
  join week_players wp on wp.week_id = w.id
  join players p on p.id = wp.player_id and p.status = 'approved'
  left join tickets t on t.week_id = w.id and t.player_id = p.id
  where w.phase = 'open' and w.revealed_at is null
    and (select ante.is_approved());
