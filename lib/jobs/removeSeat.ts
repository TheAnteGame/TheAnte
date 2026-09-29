import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEADWEIGHT_WEEKS } from "@/lib/engine/constants";
import { RemovalError, computeRemoval } from "@/lib/engine/removal";
import { fetchAllRows } from "@/lib/db/fetchAll";
import { syncLeagueSizeWhileAdmissionOpen } from "./admit";

// The deadweight removal (§13/§14, D-041), lifted out of the console action so the
// season torture test drives the SAME code the Remove button runs (D-110). Before
// this the torture test re-implemented the steps inline — close, but a copy, and the
// console path that Kegan's removal would actually take had never run end to end.
// The action keeps only what needs a signed-in commissioner: the reason, the audit
// row, the public Table Talk line, and revalidation.

/** Consecutive most-recent REVEALED weeks the player auto-folded. A submitted ticket
 *  — even a fold they chose — resets the count to zero, because they showed up. */
export async function missedWeekStreak(db: SupabaseClient, playerId: string): Promise<number> {
  const { data: weeks } = await db
    .from("weeks")
    .select("id, number")
    .not("revealed_at", "is", null)
    .order("number", { ascending: false });
  if (!weeks || weeks.length === 0) return 0;

  const { data: tickets } = await db.from("tickets").select("week_id, is_fold").eq("player_id", playerId);
  const byWeek = new Map((tickets ?? []).map((t) => [t.week_id, t.is_fold]));

  let streak = 0;
  for (const w of weeks) {
    // No row at all means the reveal never even auto-folded them (they were not on
    // the week's roster yet) — that is not a missed week, and it ends the streak.
    if (!byWeek.has(w.id)) break;
    if (byWeek.get(w.id) !== true) break;
    streak++;
  }
  return streak;
}

export type RemoveSeatResult =
  | { ok: true; who: string; stack: number; share: number; remainder: number; recipients: number; missed: number }
  | { ok: false; error: string };

export async function removeSeat(db: SupabaseClient, playerId: string, reason: string): Promise<RemoveSeatResult> {
  const fail = (error: string): RemoveSeatResult => ({ ok: false, error });

  const { data: p } = await db
    .from("players")
    .select("id, first_name, last_name, email, status")
    .eq("id", playerId)
    .maybeSingle();
  if (!p) return fail("No such player");
  if (p.status !== "approved" && p.status !== "deactivated") return fail("Only a seated player can be removed");

  // Gate 1 — the rule is objective, and the code is where it becomes binding. A
  // commissioner cannot remove a player who is still showing up, for any reason.
  const missed = await missedWeekStreak(db, playerId);
  if (missed < DEADWEIGHT_WEEKS) {
    return fail(
      `${p.first_name ?? "That player"} has missed ${missed} straight week${missed === 1 ? "" : "s"}. The deadweight rule needs ${DEADWEIGHT_WEEKS} (§14). Silence is only grounds once it is this long.`,
    );
  }

  // Gate 2 — never mid-blackout. Redistribution moves every remaining stack, and the
  // blackout's whole promise is that no stack moves between the ante and the reveal.
  const { data: openWeek } = await db
    .from("weeks")
    .select("number")
    .in("phase", ["open", "locked"])
    .is("revealed_at", null)
    .maybeSingle();
  if (openWeek) {
    return fail(
      `Week ${openWeek.number} is mid-blackout. Removal moves every stack in the league — wait for the reveal (§6).`,
    );
  }

  // The stack to redistribute, read the same way every other stack is: a SUM
  // projection of the append-only ledger. Paged, because a truncated read here would
  // silently redistribute the wrong number.
  const rows = await fetchAllRows<{ amount: number }>((from, to) =>
    db.from("ledger_entries").select("amount").eq("player_id", playerId).order("id").range(from, to),
  );
  const stack = (rows ?? []).reduce((sum, r) => sum + r.amount, 0);
  if (stack < 0) return fail(`${p.first_name ?? "That player"} holds ${stack} chips. Refusing to redistribute a negative stack.`);

  // Recipients are the seats still IN the game. A deactivated player stopped anteing
  // and left the median; they do not collect from a removal either.
  const { data: others } = await db.from("players").select("id").eq("status", "approved").neq("id", playerId);
  const recipients = (others ?? []).map((r) => r.id);
  if (recipients.length === 0) return fail("Nobody left to take the chips. Removal would destroy them.");

  // The split is the engine's, not this function's (lib/engine/removal.ts).
  const who = `${p.first_name ?? "a player"} ${(p.last_name ?? "").slice(0, 1)}.`.trim();
  let plan;
  try {
    plan = computeRemoval({ playerId, stack, recipientIds: recipients, who });
  } catch (e) {
    if (e instanceof RemovalError) return fail(e.message);
    throw e;
  }
  const { share, remainder } = plan;

  // Idempotency keys are per-account so a double-submit cannot pay anybody twice.
  const entries = plan.entries.map((e) => ({
    player_id: e.account,
    kind: e.kind,
    amount: e.amount,
    reason: e.reason,
    idempotency_key: `removal:${playerId}:${e.account ?? "pot"}`,
  }));

  const { error: ledgerErr } = await db.from("ledger_entries").insert(entries);
  if (ledgerErr && !ledgerErr.message.includes("duplicate key")) return fail(ledgerErr.message);

  const { error } = await db
    .from("players")
    .update({ status: "removed", removed_at: new Date().toISOString(), removal_reason: reason })
    .eq("id", playerId);
  if (error) return fail(error.message);

  await syncLeagueSizeWhileAdmissionOpen(db);

  return { ok: true, who, stack, share, remainder, recipients: recipients.length, missed };
}
