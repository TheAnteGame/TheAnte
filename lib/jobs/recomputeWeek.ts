import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSlateOpen } from "@/lib/engine";
import type { EnginePlayer } from "@/lib/engine";
import { fetchAllRows } from "@/lib/db/fetchAll";
import { stacksByPlayer, type JobOutcome } from "./util";

// Recompute an OPEN week's opening figures from the stacks it should have opened on
// (D-110). Commissioner-only, audited, and it moves no chips.
//
// Why it exists: Week 4 opened on 2026-09-29 while Week 3 was still unsettled, so its
// median, every house limit and its Pot figure were computed from stacks with every
// Week 3 stake still missing. openWeekCore now refuses to do that, but the week that
// already happened needs its snapshot put right before the deadline.
//
// What it will and will not touch:
//  - It rewrites weeks.median_snapshot / pot_before / tier and count snapshots, and
//    week_players.stack_pre_ante / house_limit — the numbers the bet slip and
//    submit_ticket read. None of it is blackout data (0007): stacks and limits are
//    public to the league.
//  - It never touches the ledger. The antes are already posted, so it REFUSES unless
//    the corrected stacks would have posted exactly the same antes to exactly the same
//    players — same felt, same floor chips. If they would not, this is not a snapshot
//    correction any more and it stops.
//  - It never touches a ticket. A ticket already submitted stands as submitted (§13);
//    one that would now be over its limit is reported, not changed.
//
// Computed by the same engine function slate.open uses, from stacks scoped to the
// weeks BEFORE this one, which is what "pre-ante at slate open" means.

export async function recomputeOpenWeek(db: SupabaseClient): Promise<JobOutcome> {
  const { data: week } = await db
    .from("weeks")
    .select("id, number, season_id, median_snapshot, pot_before, places_tier_snapshot, active_count_snapshot")
    .eq("phase", "open")
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!week) return { status: "skipped", detail: { reason: "no open week" } };

  const { data: behind } = await db
    .from("weeks")
    .select("number, phase")
    .eq("season_id", week.season_id)
    .lt("number", week.number)
    .neq("phase", "settled")
    .limit(1)
    .maybeSingle();
  if (behind) {
    return { status: "failed", detail: { reason: `week ${behind.number} is ${behind.phase} — settle it first; its stacks are not final` } };
  }

  const stacks = await stacksByPlayer(db, week.number - 1);
  const { data: playerRows, error: pErr } = await db
    .from("players")
    .select("id, status, shove_used_week, first_name, last_name")
    .in("status", ["approved", "deactivated"]);
  if (pErr) throw new Error(`players read failed: ${pErr.message}`);
  const nameOf = new Map((playerRows ?? []).map((p) => [p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()]));

  const enginePlayers: EnginePlayer[] = (playerRows ?? []).map((p) => ({
    id: p.id,
    status: p.status as "approved" | "deactivated",
    stackPreAnte: stacks.get(p.id) ?? 0,
    shoveUsedWeek: p.shove_used_week,
  }));
  const slate = computeSlateOpen(enginePlayers, week.number);

  // ── Refuse anything that is not a pure snapshot correction ─────────────────────
  const { data: snaps, error: sErr } = await db
    .from("week_players")
    .select("player_id, stack_pre_ante, felt, house_limit")
    .eq("week_id", week.id);
  if (sErr) throw new Error(`week_players read failed: ${sErr.message}`);
  const snapOf = new Map((snaps ?? []).map((s) => [s.player_id, s]));

  const seated = enginePlayers.filter((p) => p.status === "approved").map((p) => p.id);
  const missing = seated.filter((id) => !snapOf.has(id));
  const extra = [...snapOf.keys()].filter((id) => !seated.includes(id));
  if (missing.length || extra.length) {
    return { status: "failed", detail: { reason: "the week's roster has changed since it opened", missing, extra } };
  }
  const feltChanged = seated.filter((id) => slate.feltPlayerIds.has(id) !== (snapOf.get(id)?.felt ?? false));
  if (feltChanged.length) {
    return { status: "failed", detail: { reason: "felt status would change — the antes would differ", players: feltChanged.map((id) => nameOf.get(id) ?? id) } };
  }

  const posted = await fetchAllRows<{ player_id: string | null; amount: number }>((f, t) =>
    db.from("ledger_entries").select("player_id, amount").eq("week_id", week.id).order("id").range(f, t),
  );
  const postedBy = new Map<string, number>();
  for (const e of posted) if (e.player_id) postedBy.set(e.player_id, (postedBy.get(e.player_id) ?? 0) + e.amount);
  const expectedBy = new Map<string, number>();
  for (const e of slate.entries) if (e.account) expectedBy.set(e.account, (expectedBy.get(e.account) ?? 0) + e.amount);
  const anteMismatch = seated.filter((id) => (postedBy.get(id) ?? 0) !== (expectedBy.get(id) ?? 0));
  if (anteMismatch.length) {
    return {
      status: "failed",
      detail: {
        reason: "the chips already posted this week are not what these stacks would have posted",
        players: anteMismatch.map((id) => `${nameOf.get(id) ?? id}: posted ${postedBy.get(id) ?? 0}, expected ${expectedBy.get(id) ?? 0}`),
      },
    };
  }

  // ── Write the corrected snapshot ─────────────────────────────────────────────────
  const rows = seated.map((id) => ({
    week_id: week.id,
    player_id: id,
    stack_pre_ante: stacks.get(id) ?? 0,
    felt: slate.feltPlayerIds.has(id),
    house_limit: slate.houseLimits.get(id) ?? 0,
  }));
  const { error: upErr } = await db.from("week_players").upsert(rows, { onConflict: "week_id,player_id" });
  if (upErr) throw new Error(`week_players update failed: ${upErr.message}`);

  const potBefore = stacks.get("__pot__") ?? 0;
  const { error: wErr } = await db
    .from("weeks")
    .update({
      median_snapshot: slate.medianSnapshot,
      places_tier_snapshot: slate.placesTierSnapshot,
      active_count_snapshot: slate.activeCountSnapshot,
      pot_before: potBefore,
    })
    .eq("id", week.id);
  if (wErr) throw new Error(`week snapshot update failed: ${wErr.message}`);

  // ── Report ──────────────────────────────────────────────────────────────────────
  const { data: tickets } = await db.from("tickets").select("player_id, total_chips, is_fold").eq("week_id", week.id);
  const overLimit = (tickets ?? [])
    .filter((t) => !t.is_fold && (t.total_chips ?? 0) > (slate.houseLimits.get(t.player_id) ?? 0))
    .map((t) => `${nameOf.get(t.player_id) ?? t.player_id}: ${t.total_chips} > ${slate.houseLimits.get(t.player_id)}`);

  const limits = rows
    .filter((r) => snapOf.get(r.player_id)?.house_limit !== r.house_limit)
    .map((r) => `${nameOf.get(r.player_id) ?? r.player_id}: ${snapOf.get(r.player_id)?.house_limit} → ${r.house_limit}`);

  return {
    status: "succeeded",
    detail: {
      week: week.number,
      median: `${week.median_snapshot} → ${slate.medianSnapshot}`,
      potBefore: `${week.pot_before} → ${potBefore}`,
      tier: `${week.places_tier_snapshot} → ${slate.placesTierSnapshot}`,
      activeCount: `${week.active_count_snapshot} → ${slate.activeCountSnapshot}`,
      limits,
      submittedOverNewLimit: overLimit,
    },
  };
}
