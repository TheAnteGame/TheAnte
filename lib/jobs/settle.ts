import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertInvariants,
  potSplitForCount,
  settleWeek,
  InvariantViolation,
} from "@/lib/engine";
import type { EngineGame, EngineLedgerEntry, EngineTicket } from "@/lib/engine";
import { fetchAllRows } from "@/lib/db/fetchAll";
import { stacksByPlayer, type JobOutcome } from "./util";

// settle.week (ANTE-ADMIN §5): runs when every on-slate game is final or void.
// The conservation assertion runs BEFORE anything is written — on failure the week
// is left unsettled and the failure is loud (§8.12). Never warn-only.

export async function settleCurrentWeek(db: SupabaseClient): Promise<JobOutcome> {
  const { data: week } = await db
    .from("weeks")
    .select("*")
    .eq("phase", "revealed")
    .order("number", { ascending: true }) // oldest revealed first — a cascade replays in order
    .limit(1)
    .maybeSingle();
  if (!week) return { status: "skipped", detail: { reason: "no revealed week" } };
  return settleWeekRecord(db, week);
}

/** Settle one specific week row. runTag scopes the idempotency keys so a
 *  re-settlement replay (which reversed the prior run) can post fresh entries. */
export async function settleWeekRecord(
  db: SupabaseClient,
  week: {
    id: string;
    number: number;
    active_count_snapshot: number | null;
    marker: number;
  },
  runTag = "",
): Promise<JobOutcome> {

  const { data: games, error: gErr } = await db.from("games").select("*").eq("week_id", week.id);
  if (gErr) throw new Error(`games read failed: ${gErr.message}`);

  const slateGames = (games ?? []).filter((g) => g.on_slate);
  const unfinished = slateGames.filter(
    (g) => g.void_reason === null && !["final", "cancelled", "postponed"].includes(g.status),
  );
  if (unfinished.length > 0) {
    return { status: "skipped", detail: { reason: `${unfinished.length} games not final` } };
  }

  const engineGames: EngineGame[] = slateGames.map((g) => {
    if (g.void_reason) return { id: g.id, outcome: { kind: "void", reason: g.void_reason } };
    if (g.status === "cancelled") return { id: g.id, outcome: { kind: "void", reason: "cancelled" } };
    if (g.status === "postponed") return { id: g.id, outcome: { kind: "void", reason: "postponed" } };
    if (g.away_score == null || g.home_score == null) {
      throw new Error(`final game ${g.external_id} has no score — halting (§8.12 posture)`);
    }
    const winner = g.away_score === g.home_score ? "tie" : g.away_score > g.home_score ? "away" : "home";
    return { id: g.id, outcome: { kind: "final", winner } };
  });

  const { data: ticketRows, error: tErr } = await db
    .from("tickets")
    .select("id, player_id, is_fold, is_shove, committed_stake, pending_refund")
    .eq("week_id", week.id);
  if (tErr) throw new Error(`tickets read failed: ${tErr.message}`);

  const { data: betRows, error: bErr } = await db
    .from("bets")
    .select("id, ticket_id, game_id, side, chips")
    .in("ticket_id", (ticketRows ?? []).map((t) => t.id));
  if (bErr) throw new Error(`bets read failed: ${bErr.message}`);

  const betsByTicket = new Map<string, NonNullable<typeof betRows>>();
  for (const b of betRows ?? []) {
    betsByTicket.set(b.ticket_id, [...(betsByTicket.get(b.ticket_id) ?? []), b]);
  }
  const engineTickets: EngineTicket[] = (ticketRows ?? []).map((t) => ({
    playerId: t.player_id,
    isFold: t.is_fold,
    isShove: t.is_shove,
    bets: (betsByTicket.get(t.id) ?? []).map((b) => ({
      gameId: b.game_id,
      side: b.side as "away" | "home",
      chips: b.chips,
    })),
    committedStake: t.committed_stake,
    pendingRefund: t.pending_refund,
  }));

  // Stacks: preAnte = current minus this week's ledger delta; atReveal = current.
  // Scoped to this week and earlier: a re-settlement replays history, and history
  // did not include the weeks that come after it (D-023).
  const stacks = await stacksByPlayer(db, week.number);
  const weekEntries = await fetchAllRows<{ player_id: string | null; amount: number }>((from, to) =>
    db.from("ledger_entries").select("player_id, amount").eq("week_id", week.id).order("id").range(from, to),
  );
  const weekDelta = new Map<string, number>();
  for (const e of weekEntries) {
    if (e.player_id) weekDelta.set(e.player_id, (weekDelta.get(e.player_id) ?? 0) + e.amount);
  }

  const { data: playerRows } = await db.from("players").select("id, status").in("status", ["approved", "deactivated"]);
  const playersWithTicket = new Set((ticketRows ?? []).map((t) => t.player_id));
  const enginePlayers = (playerRows ?? [])
    .filter((p) => p.status === "approved" || playersWithTicket.has(p.id))
    .map((p) => ({
      id: p.id,
      stackPreAnte: (stacks.get(p.id) ?? 0) - (weekDelta.get(p.id) ?? 0),
      stackAtReveal: stacks.get(p.id) ?? 0,
    }));

  const result = settleWeek({
    weekNumber: week.number,
    tickets: engineTickets,
    games: engineGames,
    players: enginePlayers,
    potBalance: stacks.get("__pot__") ?? 0,
    potSplit: potSplitForCount(week.active_count_snapshot ?? 0),
  });

  // THE assertion — full ledger plus the would-be entries, before any write. Paged:
  // a truncated read here would either false-halt or, far worse, pass bad state.
  const allEntries = await fetchAllRows<{ player_id: string | null; kind: string; amount: number; reason: string }>(
    (from, to) => db.from("ledger_entries").select("player_id, kind, amount, reason").order("id").range(from, to),
  );
  const combined: EngineLedgerEntry[] = [
    ...(allEntries ?? []).map((e) => ({
      account: e.player_id,
      kind: e.kind as EngineLedgerEntry["kind"],
      amount: e.amount,
      reason: e.reason,
    })),
    ...result.entries,
  ];
  try {
    assertInvariants(combined);
  } catch (e) {
    if (e instanceof InvariantViolation) {
      return { status: "failed", detail: { halted: true, error: e.message } };
    }
    throw e;
  }

  // Writes, idempotent order: ledger (atomic insert) → bets → pot_awards → week → cards.
  const ledgerRows = toSettlementRows(result.entries, week.id, week.number, runTag);
  if (ledgerRows.length > 0) {
    const { error } = await db.from("ledger_entries").insert(ledgerRows);
    if (error && !error.message.includes("duplicate key")) throw new Error(`settlement posting failed: ${error.message}`);
  }

  const betByPlayerGame = new Map((betRows ?? []).map((b) => {
    const t = (ticketRows ?? []).find((tr) => tr.id === b.ticket_id)!;
    return [`${t.player_id}:${b.game_id}`, b.id] as const;
  }));
  for (const b of result.bets) {
    const betId = betByPlayerGame.get(`${b.playerId}:${b.gameId}`);
    if (!betId) continue;
    await db
      .from("bets")
      .update({
        multiplier: Math.round((b.multiplier.num / b.multiplier.den) * 100) / 100,
        result: b.result,
        payout: b.payout,
      })
      .eq("id", betId);
  }

  if (result.potAwards.length > 0) {
    const { error } = await db.from("pot_awards").upsert(
      result.potAwards.map((a) => ({ week_id: week.id, player_id: a.playerId, place: a.place, amount: a.amount })),
      { onConflict: "week_id,place,player_id" },
    );
    if (error) throw new Error(`pot awards write failed: ${error.message}`);
  }

  for (const playerId of result.returnedShoves) {
    // §14: the shove didn't happen — the card comes back.
    await db.from("players").update({ shove_used_week: null }).eq("id", playerId);
  }

  const potAwarded = result.potAwards.reduce((s, a) => s + a.amount, 0);
  const { error: wErr } = await db
    .from("weeks")
    .update({
      phase: "settled",
      settled_at: new Date().toISOString(),
      pot_swept: result.swept,
      pot_awarded: potAwarded,
      // The Pot's balance at the moment the award was computed — after this week's
      // returns, payouts and felt floors, before a chip of it was handed out. Display
      // only (it is what "the Pot held N" means on the settled screen); the ledger
      // remains the sole authority for chips. NOTE: slate.open also writes this column
      // at week creation with pre-ante semantics — this settlement write is the one
      // that must win, and any week settled by code older than this line still carries
      // the slate-open figure (review D-036).
      pot_before: result.potAfter + potAwarded,
      marker: result.potAfter < 0 ? -result.potAfter : 0,
    })
    .eq("id", week.id);
  if (wErr) throw new Error(`week close failed: ${wErr.message}`);

  // Monday night sends nothing (D-056). The recap now rides on Tuesday's slate-open
  // email, where it arrives beside the new week a player can actually act on: one
  // message a week instead of two, eight hours apart. Every figure it needs is read
  // back out of the ledger by that job, so nothing is lost by staying quiet here.

  return {
    status: "succeeded",
    detail: {
      week: week.number,
      bets: result.bets.length,
      swept: result.swept,
      awards: result.potAwards.length,
      marker: result.potAfter < 0 ? -result.potAfter : 0,
      returnedShoves: result.returnedShoves.length,
    },
  };
}

function toSettlementRows(entries: EngineLedgerEntry[], weekId: string, weekNumber: number, runTag = "") {
  const rows: Array<Record<string, unknown>> = [];
  const potTotals = new Map<string, number>();
  const seq = new Map<string, number>();
  for (const e of entries) {
    if (e.account === null) {
      potTotals.set(e.kind, (potTotals.get(e.kind) ?? 0) + e.amount);
    } else {
      const k = `${e.account}:${e.kind}`;
      const n = (seq.get(k) ?? 0) + 1;
      seq.set(k, n);
      rows.push({
        player_id: e.account,
        week_id: weekId,
        kind: e.kind,
        amount: e.amount,
        reason: e.reason,
        idempotency_key: `settle${runTag}:${e.kind}:${n}`,
      });
    }
  }
  for (const [kind, amount] of potTotals) {
    rows.push({
      player_id: null,
      week_id: weekId,
      kind,
      amount,
      reason: `Week ${weekNumber} — Pot side of ${kind} at settlement`,
      idempotency_key: `settle${runTag}:${kind}:pot`,
    });
  }
  return rows;
}
