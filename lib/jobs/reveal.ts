import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revealEntries } from "@/lib/engine";
import type { EngineTicket } from "@/lib/engine";
import { emailAllApproved } from "@/lib/notify/templates";
import { postSystemMessage, type JobOutcome } from "./util";

// The reveal fires the instant the last ACTIVE player's ticket lands, or Thursday
// noon — whichever comes first (§6, ANTE-PLAYER §1.5: deactivated players never
// stall it). Every deferred entry posts here, atomically: bet stakes and any shove's
// ante refund. This is also the one place players.shove_used_week is written.

interface OpenWeek {
  id: string;
  number: number;
  deadline_at: string;
}

async function currentOpenWeek(db: SupabaseClient): Promise<OpenWeek | null> {
  const { data } = await db
    .from("weeks")
    .select("id, number, deadline_at")
    .eq("phase", "open")
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function revealCheck(db: SupabaseClient): Promise<JobOutcome> {
  const week = await currentOpenWeek(db);
  if (!week) return { status: "skipped", detail: { reason: "no open week" } };

  const { data: active } = await db.from("players").select("id").eq("status", "approved");
  const { data: tickets } = await db.from("tickets").select("player_id").eq("week_id", week.id);
  const submitted = new Set((tickets ?? []).map((t) => t.player_id));
  const waiting = (active ?? []).filter((p) => !submitted.has(p.id));

  if (waiting.length > 0) {
    return { status: "skipped", detail: { reason: `waiting on ${waiting.length}` } };
  }
  return fireReveal(db, week);
}

export async function revealDeadline(db: SupabaseClient): Promise<JobOutcome> {
  const week = await currentOpenWeek(db);
  if (!week) return { status: "skipped", detail: { reason: "no open week" } };
  if (new Date() < new Date(week.deadline_at)) {
    return { status: "skipped", detail: { reason: "deadline not reached" } };
  }

  // Auto-fold everyone who missed Thursday noon. Submit nothing and you are folded,
  // and you still owe the ante — no reopening, no "my phone died" (§3).
  const { data: active } = await db.from("players").select("id").eq("status", "approved");
  const { data: tickets } = await db.from("tickets").select("player_id").eq("week_id", week.id);
  const submitted = new Set((tickets ?? []).map((t) => t.player_id));
  const folds = (active ?? [])
    .filter((p) => !submitted.has(p.id))
    .map((p) => ({ week_id: week.id, player_id: p.id, is_fold: true, total_chips: 0 }));

  if (folds.length > 0) {
    const { error } = await db.from("tickets").insert(folds);
    if (error && !error.message.includes("duplicate key")) throw new Error(`auto-fold failed: ${error.message}`);
  }

  return fireReveal(db, week, folds.length);
}

async function fireReveal(db: SupabaseClient, week: OpenWeek, autoFolded = 0): Promise<JobOutcome> {
  const { data: ticketRows, error: tErr } = await db
    .from("tickets")
    .select("id, player_id, is_fold, is_shove, committed_stake, pending_refund")
    .eq("week_id", week.id);
  if (tErr) throw new Error(`tickets read failed: ${tErr.message}`);

  const { data: betRows, error: bErr } = await db
    .from("bets")
    .select("ticket_id, game_id, side, chips")
    .in("ticket_id", (ticketRows ?? []).map((t) => t.id));
  if (bErr) throw new Error(`bets read failed: ${bErr.message}`);

  const betsByTicket = new Map<string, Array<{ gameId: string; side: "away" | "home"; chips: number }>>();
  for (const b of betRows ?? []) {
    const list = betsByTicket.get(b.ticket_id) ?? [];
    list.push({ gameId: b.game_id, side: b.side as "away" | "home", chips: b.chips });
    betsByTicket.set(b.ticket_id, list);
  }

  const engineTickets: EngineTicket[] = (ticketRows ?? []).map((t) => ({
    playerId: t.player_id,
    isFold: t.is_fold,
    isShove: t.is_shove,
    bets: betsByTicket.get(t.id) ?? [],
    committedStake: t.committed_stake,
    pendingRefund: t.pending_refund,
  }));

  // Atomic: stakes + shove refunds in one insert, idempotency-keyed.
  const entries = revealEntries(engineTickets, week.number);
  const rows: Array<Record<string, unknown>> = [];
  const potTotals = new Map<string, number>();
  const perPlayerSeq = new Map<string, number>();
  for (const e of entries) {
    if (e.account === null) {
      potTotals.set(e.kind, (potTotals.get(e.kind) ?? 0) + e.amount);
    } else {
      const seqKey = `${e.account}:${e.kind}`;
      const seq = (perPlayerSeq.get(seqKey) ?? 0) + 1;
      perPlayerSeq.set(seqKey, seq);
      rows.push({
        player_id: e.account,
        week_id: week.id,
        kind: e.kind,
        amount: e.amount,
        reason: e.reason,
        idempotency_key: `reveal:${e.kind}:${seq}`,
      });
    }
  }
  for (const [kind, amount] of potTotals) {
    rows.push({
      player_id: null,
      week_id: week.id,
      kind,
      amount,
      reason: `Week ${week.number} — Pot side of ${kind} at reveal`,
      idempotency_key: `reveal:${kind}:pot`,
    });
  }
  if (rows.length > 0) {
    const { error } = await db.from("ledger_entries").insert(rows);
    if (error && !error.message.includes("duplicate key")) throw new Error(`reveal posting failed: ${error.message}`);
  }

  // shove_used_week is written by the reveal job, never the submit handler (§7).
  for (const t of ticketRows ?? []) {
    if (t.is_shove) {
      await db.from("players").update({ shove_used_week: week.number }).eq("id", t.player_id);
    }
  }

  const { error: wErr } = await db
    .from("weeks")
    .update({ phase: "revealed", revealed_at: new Date().toISOString() })
    .eq("id", week.id)
    .eq("phase", "open"); // guard against a concurrent fire
  if (wErr) throw new Error(`reveal phase flip failed: ${wErr.message}`);

  await postSystemMessage(db, `The room is open — every Week ${week.number} ticket is live.`);
  await emailAllApproved(
    db,
    "notify.reveal",
    `ANTE — the Week ${week.number} room is open`,
    { week: week.number },
    `notify.reveal:w${week.number}`,
  );

  return {
    status: "succeeded",
    detail: { week: week.number, tickets: ticketRows?.length ?? 0, autoFolded },
  };
}
