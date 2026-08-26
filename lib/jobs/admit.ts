import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAdmission } from "@/lib/engine";
import { fetchAllRows } from "@/lib/db/fetchAll";

// Deal a late-admitted (or reactivated) player into the currently open week (D-020,
// reaffirmed D-034, hardened per review D-036). The arithmetic lives in the pure
// engine (computeAdmission) — felt evaluation, ante, the §9 floor, the limit from the
// week's frozen median — so this job only does I/O. The week's median, active count
// and places tier stay exactly as slate open snapshotted them (§7).

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

  // Already dealt in → a strict no-op. Without this, a reactivation mid-week re-read
  // the ledger AFTER the ante and rewrote the snapshot with the ante double-counted,
  // shrinking the limit (review D-036). The ante insert below is idempotent by key;
  // the snapshot must be idempotent by refusing to recompute.
  const { data: existing } = await db
    .from("week_players")
    .select("player_id")
    .eq("week_id", week.id)
    .eq("player_id", playerId)
    .maybeSingle();
  if (existing) return;

  const ledger = await fetchAllRows<{ amount: number }>((f, t) =>
    db.from("ledger_entries").select("amount").eq("player_id", playerId).order("id").range(f, t),
  );
  const stackPreAnte = ledger.reduce((sum, e) => sum + Number(e.amount), 0);

  const admission = computeAdmission(stackPreAnte, week.ante, week.median_snapshot ?? stackPreAnte - week.ante);

  const rows = admission.entries.map((e) => ({
    player_id: e.account === null ? null : playerId,
    week_id: week.id,
    kind: e.kind,
    amount: e.amount,
    reason: `Week ${week.number} — ${e.reason}`,
    // Player side keys on open:<kind> so a slate.open retry cannot double-post; the
    // Pot side needs its own per-player key — slate.open's aggregated pot rows already
    // hold open:<kind>:pot, and colliding with them would charge the player while the
    // Pot went uncredited, breaking conservation.
    idempotency_key: e.account === null ? `admit:${e.kind}:pot:${playerId}` : `open:${e.kind}`,
  }));
  if (rows.length > 0) {
    const { error } = await db.from("ledger_entries").insert(rows);
    if (error && !error.message.includes("duplicate key")) throw new Error(error.message);
  }

  const { error: snapError } = await db.from("week_players").upsert(
    {
      week_id: week.id,
      player_id: playerId,
      stack_pre_ante: stackPreAnte,
      felt: admission.felt,
      house_limit: admission.houseLimit,
    },
    { onConflict: "week_id,player_id" },
  );
  if (snapError) throw new Error(`week_players admit failed: ${snapError.message}`);
}
