-- 0023 — The commissioner's seat is public to the league (D-066).
--
-- Who runs the league is not a secret: §2 makes the seat singular and visible, the
-- rulebook names the commissioner's powers throughout, and Table Talk now tags their
-- messages so the room can tell an announcement from an opinion. The table had RLS
-- enabled and NO select policy at all, so a player client could not read it — the
-- only way to learn the seat was the service role, which ANTE-TECH §4.3 forbids on a
-- player surface. A read policy is the correct boundary; smuggling it in past RLS
-- would not be.
--
-- Read only, approved players only. Writes stay admin-only — no insert/update/delete
-- policy, so the seat still moves solely through a commissioner action's service
-- client, exactly as before.
create policy commissioner_read on commissioner for select to authenticated
  using (ante.is_approved());
