import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AwardsInput, FinalStanding } from "@/lib/engine/awards";
import { fetchAllRows } from "@/lib/db/fetchAll";

// Season-end data assembly (service role, admin/close paths only). Everything is
// derived from the ledger and the immutable ticket record — nothing here is a
// second source of truth.

export interface SeasonData {
  awardsInput: AwardsInput;
  standings: FinalStanding[];
  names: Map<string, string>;
  allSettled: boolean;
  latestMarker: number;
}

export async function gatherSeasonData(db: SupabaseClient): Promise<SeasonData> {
  const [{ data: players }, { data: weeks }, { data: tickets }, { data: betRows }, { data: ledger }, { data: pots }, { data: wps }] =
    await Promise.all([
      db.from("players").select("id, status, first_name, last_name").in("status", ["approved", "deactivated"]),
      db.from("weeks").select("id, number, phase, marker").order("number"),
      db.from("tickets").select("id, week_id, player_id, is_fold, is_shove, submitted_at"),
      db.from("bets").select("ticket_id, chips, multiplier, result"),
      fetchAllRows<{ player_id: string | null; week_id: string | null; kind: string; amount: number }>((f, t) =>
        db.from("ledger_entries").select("player_id, week_id, kind, amount").order("id").range(f, t),
      ).then((rows) => ({ data: rows })),
      db.from("pot_awards").select("player_id, week_id"),
      db.from("week_players").select("player_id, felt"),
    ]);

  const weekNumById = new Map((weeks ?? []).map((w) => [w.id, w.number]));
  const ticketById = new Map((tickets ?? []).map((t) => [t.id, t]));

  const stacks = new Map<string, number>();
  for (const e of ledger ?? []) {
    if (e.player_id) stacks.set(e.player_id, (stacks.get(e.player_id) ?? 0) + e.amount);
  }

  // Weekly gains: net including ante, before the Pot (§14) — pot awards excluded.
  const gains = new Map<string, number>();
  for (const e of ledger ?? []) {
    if (!e.player_id || !e.week_id || e.kind === "pot_award") continue;
    const k = `${e.player_id}:${weekNumById.get(e.week_id)}`;
    gains.set(k, (gains.get(k) ?? 0) + e.amount);
  }

  const everFelt = new Set((wps ?? []).filter((w) => w.felt).map((w) => w.player_id));

  const awardsInput: AwardsInput = {
    players: (players ?? []).map((p) => ({
      id: p.id,
      status: p.status as "approved" | "deactivated",
      finalStack: stacks.get(p.id) ?? 0,
      everOnFelt: everFelt.has(p.id),
    })),
    tickets: (tickets ?? []).map((t) => ({
      week: weekNumById.get(t.week_id) ?? 0,
      playerId: t.player_id,
      isFold: t.is_fold,
      isShove: t.is_shove,
      submittedAtMs: new Date(t.submitted_at).getTime(),
    })),
    bets: (betRows ?? []).map((b) => {
      const t = ticketById.get(b.ticket_id);
      return {
        playerId: t?.player_id ?? "",
        week: t ? (weekNumById.get(t.week_id) ?? 0) : 0,
        chips: b.chips,
        multiplier: b.multiplier === null ? null : Number(b.multiplier),
        result: (b.result ?? "returned") as "won" | "lost" | "returned" | "void",
        isShove: t?.is_shove ?? false,
      };
    }),
    weeklyGains: [...gains.entries()].map(([k, gain]) => {
      const [playerId, week] = k.split(":");
      return { playerId, week: Number(week), gain };
    }),
    potsWon: [],
    weeksPlayed: (weeks ?? []).filter((w) => w.phase === "settled").map((w) => w.number),
  };

  const potCount = new Map<string, number>();
  for (const p of pots ?? []) potCount.set(p.player_id, (potCount.get(p.player_id) ?? 0) + 1);

  const standings: FinalStanding[] = awardsInput.players.map((p) => ({
    playerId: p.id,
    stack: p.finalStack,
    winningBets: awardsInput.bets.filter((b) => b.playerId === p.id && b.result === "won").length,
    potsWon: potCount.get(p.id) ?? 0,
    weeksFolded: awardsInput.tickets.filter((t) => t.playerId === p.id && t.isFold).length,
    eligible: p.status === "approved",
  }));

  const names = new Map(
    (players ?? []).map((p) => [p.id, `${p.first_name ?? ""} ${(p.last_name ?? "").slice(0, 1)}.`.trim() || "—"]),
  );

  const settledWeeks = (weeks ?? []).filter((w) => w.phase === "settled");
  const allSettled = settledWeeks.some((w) => w.number === 18);
  const latestMarker = settledWeeks.length > 0 ? settledWeeks[settledWeeks.length - 1].marker : 0;

  return { awardsInput, standings, names, allSettled, latestMarker };
}
