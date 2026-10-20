import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunk, fetchAllRows } from "@/lib/db/fetchAll";
import type { PlayerProfile } from "./playStyle";

// Reads the history the play-style card is computed from (D-113).
//
// BLACKOUT: SETTLED weeks only — a week that is revealed but not yet paid has no
// results to learn from, and an open week's tickets are never read. So the card sits
// perfectly still from the ante to the payout (§6), like League Stats beside it.
// Read through the caller's client: the same RLS that lets every approved player see
// revealed tickets and bets serves this, and nothing here is any wider than that.

export const gatherPlayProfiles = cache(async (db: SupabaseClient): Promise<PlayerProfile[]> => {
  const [{ data: weekRows }, { data: playerRows }] = await Promise.all([
    db.from("weeks").select("id").not("settled_at", "is", null),
    db.from("players").select("id, favorite_team").eq("status", "approved"),
  ]);
  const weekIds = (weekRows ?? []).map((w) => w.id);
  const players = playerRows ?? [];
  if (weekIds.length === 0 || players.length === 0) return [];

  const [tickets, games, ledger] = await Promise.all([
    fetchAllRows<{ id: string; player_id: string; week_id: string; is_fold: boolean; is_shove: boolean }>((f, t) =>
      db.from("tickets").select("id, player_id, week_id, is_fold, is_shove").in("week_id", weekIds).order("id").range(f, t),
    ),
    fetchAllRows<{ id: string; week_id: string; away_team: string; home_team: string; on_slate: boolean }>((f, t) =>
      db.from("games").select("id, week_id, away_team, home_team, on_slate").in("week_id", weekIds).order("id").range(f, t),
    ),
    fetchAllRows<{ player_id: string | null; amount: number }>((f, t) =>
      db.from("ledger_entries").select("player_id, amount").in("week_id", weekIds).order("id").range(f, t),
    ),
  ]);

  type BetRow = { ticket_id: string; game_id: string; side: string; chips: number; multiplier: number | null; result: string | null; payout: number | null };
  // Chunked for the same reason gather.ts is: the ticket-id list rides in the URL.
  const bets: BetRow[] = (
    await Promise.all(
      chunk(tickets.map((t) => t.id)).map((ids) =>
        fetchAllRows<BetRow>((f, t) =>
          db.from("bets").select("ticket_id, game_id, side, chips, multiplier, result, payout").in("ticket_id", ids).order("id").range(f, t),
        ),
      ),
    )
  ).flat();

  const result = new Map<string, number>();
  for (const e of ledger) if (e.player_id) result.set(e.player_id, (result.get(e.player_id) ?? 0) + Number(e.amount));

  const betsByTicket = new Map<string, BetRow[]>();
  for (const b of bets) betsByTicket.set(b.ticket_id, [...(betsByTicket.get(b.ticket_id) ?? []), b]);
  const slateByWeek = new Map<string, typeof games>();
  for (const g of games) if (g.on_slate) slateByWeek.set(g.week_id, [...(slateByWeek.get(g.week_id) ?? []), g]);
  const gameById = new Map(games.map((g) => [g.id, g]));

  return players.map((p) => {
    // A shove is the whole stack on one game, once a season (§8). Counted, it would make
    // its owner a "sniper" for good on one decision, so habits leave it out; the
    // result — the ranking — keeps it, because the chips really moved.
    const live = tickets.filter((t) => t.player_id === p.id && !t.is_fold && !t.is_shove);
    const mine = live.flatMap((t) => betsByTicket.get(t.id) ?? []);
    const decided = mine.filter((b) => b.result === "won" || b.result === "lost");

    let homeChances = 0;
    let homeBacked = 0;
    if (p.favorite_team) {
      for (const t of live) {
        const g = (slateByWeek.get(t.week_id) ?? []).find((x) => x.away_team === p.favorite_team || x.home_team === p.favorite_team);
        if (!g) continue;
        homeChances++;
        const b = (betsByTicket.get(t.id) ?? []).find((x) => x.game_id === g.id);
        const backed = b ? (b.side === "away" ? gameById.get(b.game_id)?.away_team : gameById.get(b.game_id)?.home_team) : null;
        if (backed === p.favorite_team) homeBacked++;
      }
    }

    return {
      playerId: p.id,
      liveWeeks: live.length,
      bets: mine.length,
      chipsBet: mine.reduce((s, b) => s + Number(b.chips), 0),
      decided: decided.length,
      won: decided.filter((b) => b.result === "won").length,
      crowd: decided.filter((b) => b.multiplier !== null && Number(b.multiplier) < 1).length,
      lonely: decided.filter((b) => b.multiplier !== null && Number(b.multiplier) > 1).length,
      chipsDecided: decided.reduce((s, b) => s + Number(b.chips), 0),
      net: decided.reduce((s, b) => s + (b.result === "won" ? Number(b.payout ?? 0) : -Number(b.chips)), 0),
      homeChances,
      homeBacked,
      result: result.get(p.id) ?? 0,
    };
  });
});
