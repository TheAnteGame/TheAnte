import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunk, fetchAllRows } from "@/lib/db/fetchAll";
import {
  headToHead,
  leagueHighlights,
  playerTendencies,
  type LeagueHighlights,
  type PlayerTendency,
  type StatBet,
  type StatTicket,
  type WeeklyGain,
} from "./league";

// Reads the history the live stats are computed from (D-022).
//
// BLACKOUT: every read here is scoped to weeks with revealed_at set. A player's own
// live ticket is never included, so nothing on these surfaces can move between the
// ante and the reveal (§6) — same rule the standings view already follows.

export interface LeagueStats {
  weeks: Array<{ id: string; number: number; settled: boolean }>;
  tendencies: PlayerTendency[];
  highlights: LeagueHighlights;
  nameOf: (playerId: string) => string;
  /** Your record against everyone else, week by week. */
  h2hFor: (playerId: string) => ReturnType<typeof headToHead>;
}

export async function gatherLeagueStats(db: SupabaseClient): Promise<LeagueStats> {
  const [{ data: weekRows }, { data: playerRows }] = await Promise.all([
    db.from("weeks").select("id, number, settled_at, revealed_at").not("revealed_at", "is", null).order("number"),
    db.from("players").select("id, first_name, last_name").in("status", ["approved", "deactivated"]),
  ]);

  const weeks = (weekRows ?? []).map((w) => ({ id: w.id, number: w.number, settled: !!w.settled_at }));
  const players = playerRows ?? [];
  const nameOf = (id: string) => {
    const p = players.find((x) => x.id === id);
    return p ? `${p.first_name ?? ""} ${(p.last_name ?? "").slice(0, 1)}.`.trim() || "—" : "—";
  };

  if (weeks.length === 0) {
    return {
      weeks,
      tendencies: [],
      highlights: { biggestWeek: null, bestPrice: null, coldestTake: null, hotHand: null },
      nameOf,
      h2hFor: () => [],
    };
  }

  const weekIds = weeks.map((w) => w.id);
  const weekNumber = new Map(weeks.map((w) => [w.id, w.number]));

  const [tickets, games] = await Promise.all([
    fetchAllRows<{ id: string; player_id: string; week_id: string; is_fold: boolean; is_shove: boolean }>((f, t) =>
      db.from("tickets").select("id, player_id, week_id, is_fold, is_shove").in("week_id", weekIds).order("id").range(f, t),
    ),
    fetchAllRows<{ id: string; away_team: string; home_team: string }>((f, t) =>
      db.from("games").select("id, away_team, home_team").in("week_id", weekIds).order("id").range(f, t),
    ),
  ]);

  const ticketById = new Map(tickets.map((t) => [t.id, t]));
  const gameById = new Map(games.map((g) => [g.id, g]));

  // Chunked: the ticket-id list grows every week, and PostgREST carries `in.(...)` in
  // the URL — unchunked this 414s from Week 9 of a 25-player season, taking the results
  // page and the dashboard's League Stats box down with it.
  type BetRow = { ticket_id: string; game_id: string; side: string; chips: number; multiplier: number | null; result: string | null };
  const betRows: BetRow[] = (
    await Promise.all(
      chunk(tickets.map((x) => x.id)).map((ids) =>
        fetchAllRows<BetRow>((f, t) =>
          db
            .from("bets")
            .select("ticket_id, game_id, side, chips, multiplier, result")
            .in("ticket_id", ids)
            .order("id")
            .range(f, t),
        ),
      ),
    )
  ).flat();

  const bets: StatBet[] = betRows.flatMap((b) => {
    const t = ticketById.get(b.ticket_id);
    const g = gameById.get(b.game_id);
    if (!t || !g) return [];
    return [
      {
        playerId: t.player_id,
        week: weekNumber.get(t.week_id) ?? 0,
        chips: Number(b.chips),
        multiplier: b.multiplier === null ? null : Number(b.multiplier),
        result: (b.result ?? "returned") as StatBet["result"],
        isShove: t.is_shove,
        team: b.side === "away" ? g.away_team : g.home_team,
      },
    ];
  });

  const statTickets: StatTicket[] = tickets.map((t) => ({
    playerId: t.player_id,
    week: weekNumber.get(t.week_id) ?? 0,
    isFold: t.is_fold,
  }));

  // §14 — a week's gain is the net change to a stack INCLUDING the ante and BEFORE the
  // Pot is awarded, which is exactly what the Pot is then paid on.
  const ledger = await fetchAllRows<{ player_id: string | null; week_id: string | null; kind: string; amount: number }>(
    (f, t) =>
      db.from("ledger_entries").select("player_id, week_id, kind, amount").in("week_id", weekIds).order("id").range(f, t),
  );
  const gainMap = new Map<string, number>();
  for (const e of ledger) {
    if (!e.player_id || !e.week_id || e.kind === "pot_award") continue;
    const key = `${e.player_id}:${weekNumber.get(e.week_id)}`;
    gainMap.set(key, (gainMap.get(key) ?? 0) + Number(e.amount));
  }
  const gains: WeeklyGain[] = [...gainMap.entries()].map(([key, gain]) => {
    const [playerId, week] = key.split(":");
    return { playerId, week: Number(week), gain };
  });

  // Highlights read the most recent SETTLED week: an unsettled reveal has no results.
  const settledWeeks = new Set(weeks.filter((w) => w.settled).map((w) => w.number));
  const settledGains = gains.filter((g) => settledWeeks.has(g.week));
  const settledBets = bets.filter((b) => settledWeeks.has(b.week));

  return {
    weeks,
    tendencies: playerTendencies(players.map((p) => p.id), bets, statTickets, gains),
    highlights: leagueHighlights(settledBets, settledGains),
    nameOf,
    h2hFor: (id: string) => headToHead(id, settledGains),
  };
}
