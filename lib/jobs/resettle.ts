import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type JobOutcome } from "./util";
import { settleWeekRecord } from "./settle";
import { fetchAllRows } from "@/lib/db/fetchAll";

// Re-settlement (§13, ANTE-ADMIN §4.2): reverses the prior run's ledger entries
// with explicit reversal rows — it never deletes them — then replays the week and
// every later settled week in order, because the median, house limits, and pot
// eligibility all cascade. Locked tickets are INPUTS to the replay, never outputs:
// no code path scales, trims, or voids a submitted ticket (acceptance test 28);
// the §9 floor absorbs any overdraft.

export async function resettleFromWeek(
  db: SupabaseClient,
  fromWeekNumber: number,
  reason: string,
): Promise<JobOutcome> {
  const { data: weeks } = await db
    .from("weeks")
    .select("*")
    .eq("phase", "settled")
    .gte("number", fromWeekNumber)
    .order("number", { ascending: true });
  if (!weeks || weeks.length === 0) {
    return { status: "skipped", detail: { reason: `no settled weeks at or after week ${fromWeekNumber}` } };
  }

  const runTag = `-r${randomUUID().slice(0, 8)}`;
  const results: Array<{ week: number; status: string }> = [];

  // Reverse and replay ONE WEEK AT A TIME, in order.
  //
  // Reversing every week up front and only then replaying looks equivalent and is not:
  // the Pot is awarded from its own live balance (§7), and reversing weeks 6–8 puts
  // their swept chips back into it before week 5 replays. Week 5 then awards a Pot
  // holding three later weeks' money — in the torture test, −3,842 became −11,783 and
  // roughly 7,900 chips left the Pot on a re-settlement that changed nothing at all.
  //
  // Total conservation still balances when that happens, because the Pot absorbs the
  // difference, which is exactly why it went unnoticed. Each week must replay against
  // the Pot balance it actually saw, so the two phases interleave.
  for (const week of weeks) {
    const entries = await fetchAllRows<{ id: string; player_id: string | null; kind: string; amount: number; idempotency_key: string | null }>(
      (f, t) => db.from("ledger_entries").select("id, player_id, kind, amount, idempotency_key").eq("week_id", week.id).like("idempotency_key", "settle%").order("id").range(f, t),
    );
    const { data: reversals } = await db
      .from("ledger_entries")
      .select("reversal_of")
      .eq("week_id", week.id)
      .eq("kind", "reversal")
      .not("reversal_of", "is", null);
    const reversed = new Set((reversals ?? []).map((r) => r.reversal_of));

    const rows = (entries ?? [])
      .filter((e) => !reversed.has(e.id))
      .map((e) => ({
        player_id: e.player_id,
        week_id: week.id,
        kind: "reversal",
        amount: -e.amount,
        reason: `Re-settlement of Week ${week.number}: ${reason}`,
        reversal_of: e.id,
        idempotency_key: `resettle:${e.id}`,
      }));
    if (rows.length > 0) {
      const { error } = await db.from("ledger_entries").insert(rows);
      if (error && !error.message.includes("duplicate key")) {
        return { status: "failed", detail: { error: `reversal failed for week ${week.number}: ${error.message}` } };
      }
    }

    // Derived rows are rebuilt by the replay; the ledger is the record (§13).
    await db.from("pot_awards").delete().eq("week_id", week.id);
    await db
      .from("weeks")
      .update({ phase: "revealed", settled_at: null, pot_swept: null, pot_awarded: null, marker: 0 })
      .eq("id", week.id);

    // Replay immediately, before the next week is reversed, so this week sees the
    // stacks and the Pot exactly as it did the first time.
    const { data: fresh } = await db.from("weeks").select("*").eq("id", week.id).single();
    const outcome = await settleWeekRecord(db, fresh, runTag);
    results.push({ week: week.number, status: outcome.status });
    if (outcome.status === "failed") {
      return { status: "failed", detail: { halted_at_week: week.number, results } };
    }
  }

  return { status: "succeeded", detail: { from: fromWeekNumber, weeks: results } };
}
