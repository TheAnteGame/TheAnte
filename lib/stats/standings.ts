import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/db/fetchAll";
import { projectWeek, type ProjectionOutcome, type ProjectionTicket, type PlayerProjection } from "@/lib/engine/projection";

// Stacks between the reveal and settlement (D-073, generalised by D-075).
//
// A stake leaves its stack at the reveal and does not come back until settlement, so
// ranking on raw SUM(ledger) ranks by who risked the LEAST — on 2026-09-10 the two
// players who FOLDED led the board while the player who committed most sat last.
//
// D-073 fixed that by adding every stake back, which said "nothing is decided yet".
// True on Thursday afternoon, decreasingly true all weekend: once a game is final,
// those chips ARE decided and pretending otherwise is its own lie. This adds back
// only what can still come back and credits the profit already earned, so the board
// moves as each game goes in. With no games final it is identical to D-073 — a level
// board — which is exactly the behaviour it replaces.
//
// Read-only. The ledger is untouched, a stack is still SUM(ledger), and settlement is
// still the one event that moves a chip.

export interface WeekProjection {
  weekId: string;
  /** Per player, keyed by player id. Absent for anyone with no ticket. */
  byPlayer: Map<string, PlayerProjection>;
  /** Slate games already decided, and the slate size. */
  gamesIn: number;
  gamesTotal: number;
}

/** One load per request, not per component: the dashboard mounts the leaderboard
 *  twice (D-051) and the ticker and Table Talk both want the same numbers. */
export const loadProjection = cache(async (db: SupabaseClient): Promise<WeekProjection | null> => {
  const { data: week } = await db
    .from("weeks")
    .select("id, revealed_at, settled_at")
    .in("phase", ["open", "revealed", "settled"])
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Nothing to project before the reveal — no stake has left a stack yet, and asking
  // for tickets during a blackout is the wrong question anyway (RLS refuses them).
  // Nothing to project after settlement either: the ledger is then the truth.
  if (!week?.revealed_at || week.settled_at) return null;

  const [{ data: tickets }, { data: games }] = await Promise.all([
    db.from("tickets").select("id, player_id, is_shove").eq("week_id", week.id),
    db.from("games").select("id, status, away_score, home_score, void_reason").eq("week_id", week.id).eq("on_slate", true),
  ]);

  const ticketRows = tickets ?? [];
  const bets = ticketRows.length
    ? await fetchAllRows<{ ticket_id: string; game_id: string; side: string; chips: number }>((from, to) =>
        db
          .from("bets")
          .select("ticket_id, game_id, side, chips")
          .in("ticket_id", ticketRows.map((t) => t.id))
          .order("id")
          .range(from, to),
      )
    : [];

  // Deliberately the same mapping settleWeek uses, in the same order, so a game
  // cannot read one way here and another way on Monday.
  const outcomes = new Map<string, ProjectionOutcome>();
  let gamesIn = 0;
  for (const g of games ?? []) {
    let o: ProjectionOutcome;
    if (g.void_reason) o = { kind: "void", reason: g.void_reason };
    else if (g.status === "cancelled") o = { kind: "void", reason: "cancelled" };
    else if (g.status === "postponed") o = { kind: "void", reason: "postponed" };
    else if (g.status === "final" && g.away_score != null && g.home_score != null)
      o = {
        kind: "final",
        winner: g.away_score === g.home_score ? "tie" : g.away_score > g.home_score ? "away" : "home",
      };
    // A game flagged final with no score is NOT guessed at. settleWeek halts on that
    // (§8.12 posture); a projection has even less business inventing a winner, so it
    // stays pending and the chips stay at risk.
    else o = { kind: "pending" };
    if (o.kind !== "pending") gamesIn += 1;
    outcomes.set(g.id, o);
  }

  const projTickets: ProjectionTicket[] = ticketRows.map((t) => ({
    playerId: t.player_id,
    isShove: t.is_shove,
    bets: bets
      .filter((b) => b.ticket_id === t.id)
      .map((b) => ({ gameId: b.game_id, side: b.side as "away" | "home", chips: b.chips })),
  }));

  return {
    weekId: week.id,
    byPlayer: projectWeek({ tickets: projTickets, outcomes }),
    gamesIn,
    gamesTotal: (games ?? []).length,
  };
});

export interface RankableRow {
  player_id: string | null;
  stack: number | null;
}

/** Apply the projection to standings rows and re-rank. Ties share a rank, matching
 *  the view's own `rank() over (order by stack desc)` — on a level board everyone
 *  really is first, and leaderFrom() depends on that to report a tie rather than
 *  crowning whoever sorted first. */
export function withProjection<T extends RankableRow>(
  rows: T[],
  proj: WeekProjection | null,
): Array<T & { stack: number; rank: number }> {
  const adjusted = rows.map((r) => {
    const p = r.player_id ? proj?.byPlayer.get(r.player_id) : undefined;
    return { ...r, stack: (r.stack ?? 0) + (p ? p.returnable + p.profit : 0) };
  });
  adjusted.sort((a, b) => b.stack - a.stack);
  let rank = 0;
  let prev: number | null = null;
  return adjusted.map((r, i) => {
    if (prev === null || r.stack !== prev) rank = i + 1;
    prev = r.stack;
    return { ...r, rank };
  });
}
