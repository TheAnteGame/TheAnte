-- 0020 — The roster lock had no hand to set it (D-046).
--
-- §1 and §13: admission "is preseason-only and dies at the Week 1 deadline along with
-- the roster." The column for that moment has existed since 0001 and nothing ever
-- wrote it — week1_lock_at was read in five places and set in none, so admissionOpen
-- returned true forever and Approve/Reject stayed live all season. A rule the rulebook
-- states plainly was simply not in force.
--
-- slateOpen now records it when Week 1 opens. This backfills any season already past
-- that moment, taking the lock from Week 1's own deadline — the same value the job
-- would have written. Idempotent, and it never overwrites a lock already set by hand.

update seasons s
   set week1_lock_at = w.deadline_at
  from weeks w
 where w.season_id = s.id
   and w.number = 1
   and s.week1_lock_at is null;

comment on column seasons.week1_lock_at is
  'The moment admission closes and the roster is fixed (§1, §13). Written by slate.open when Week 1 opens, backfilled by 0020 for seasons already open. Null means admission is still open — which, before D-046, it always was.';
