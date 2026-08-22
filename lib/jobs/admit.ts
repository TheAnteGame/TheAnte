import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { houseLimit, isFelt } from "@/lib/engine";
import { fetchAllRows } from "@/lib/db/fetchAll";

// Deal a late-admitted (or reactivated) player into the currently open week (D-020,
// reaffirmed D-034: the roster locks at the WEEK 1 DEADLINE, not at slate open —
// anyone the commissioner approves plays that same week). Lives here rather than in
// the admin actions so the season torture test can exercise the REAL code path: the
// D-023 lesson is that chip-moving logic no test can reach is chip-moving logic that
// is quietly wrong.
//
// The week's median, active count and places tier stay exactly as slate open
// snapshotted them — those are fixed for the week (§7). The newcomer gets the same
// ante everyone else paid and a house limit computed from the same frozen median.

export async function admitToOpenWeek(db: SupabaseClient, playerId: string): Promise<void> {
  const { data: week } = await db
    .from("weeks")
    .select("id, number, ante, median_snapshot, deadline_at")
    .eq("phase", "open")
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!week) return;
  // Past the deadline there is nothing to join: the reveal is next, and charging an
  // ante for a week they could never have bet would be taking chips for nothing.
  if (new Date(week.deadline_at) <= new Date()) return;

  const entries = await fetchAllRows<{ amount: number }>((f, t) =>
    db.from("ledger_entries").select("amount").eq("player_id", playerId).order("id").range(f, t),
  );
  const stackPreAnte = entries.reduce((sum, e) => sum + Number(e.amount), 0);
  const ante = week.ante;
  const felt = isFelt(stackPreAnte, ante);

  if (!felt) {
    // Player side keys on open:ante so a later slate.open retry cannot ante them twice.
    // The Pot side needs its OWN key: slate.open writes one aggregated pot row per week
    // under open:ante:pot, and reusing that key here would be rejected as a duplicate —
    // charging the player while the Pot went uncredited, breaking conservation.
    const { error } = await db.from("ledger_entries").insert([
      {
        player_id: playerId,
        week_id: week.id,
        kind: "ante",
        amount: -ante,
        reason: `Week ${week.number} ante`,
        idempotency_key: "open:ante",
      },
      {
        player_id: null,
        week_id: week.id,
        kind: "ante",
        amount: ante,
        reason: `Week ${week.number} — Pot side of ante (admitted after slate open)`,
        idempotency_key: `admit:ante:pot:${playerId}`,
      },
    ]);
    if (error && !error.message.includes("duplicate key")) throw new Error(error.message);
  }

  const { error: snapError } = await db.from("week_players").upsert(
    {
      week_id: week.id,
      player_id: playerId,
      stack_pre_ante: stackPreAnte,
      felt,
      house_limit: felt ? stackPreAnte : houseLimit(stackPreAnte - ante, week.median_snapshot ?? stackPreAnte - ante),
    },
    { onConflict: "week_id,player_id" },
  );
  if (snapError) throw new Error(`week_players admit failed: ${snapError.message}`);
}
