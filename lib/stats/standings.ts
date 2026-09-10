import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/db/fetchAll";

// Stacks during the revealed window (D-073).
//
// A bet's stake leaves the player's stack at the reveal and does not come back until
// settlement. The standings view ranks on SUM(ledger), so for the four days between
// the two the board ranks by who risked the LEAST — and on 2026-09-10 the two players
// who FOLDED sat top of the table on 490 while the player who committed the most sat
// last on 330. Nothing had been won or lost; the board just showed the withdrawal.
//
// This is the mirror of D-070. The same escrowed chips that must not be counted in
// the Pot must not be missing from the players either. Adding them back says the
// truthful thing — nothing is decided yet — and leaves settlement to be the moment
// the board actually moves, which is the moment the game is built around.
//
// Display only. The ledger is untouched and a stack remains SUM(ledger); this is what
// a player is SHOWN while their chips are in flight.

/** Per-player chips staked on weeks that have not settled. Empty before a reveal,
 *  because no stake has been posted yet — which is also the only correct answer
 *  during a blackout. */
export async function openStakesByPlayer(db: SupabaseClient): Promise<Map<string, number>> {
  const { data: weeks } = await db.from("weeks").select("id, settled_at");
  const open = (weeks ?? []).filter((w) => !w.settled_at).map((w) => w.id as string);
  const out = new Map<string, number>();
  if (open.length === 0) return out;

  const rows = await fetchAllRows<{ player_id: string | null; amount: number }>((from, to) =>
    db
      .from("ledger_entries")
      .select("player_id, amount")
      .eq("kind", "bet_stake")
      .in("week_id", open)
      .not("player_id", "is", null)
      .order("id")
      .range(from, to),
  );
  // Stakes are posted as negative amounts against the player; hold the positive.
  for (const e of rows) if (e.player_id) out.set(e.player_id, (out.get(e.player_id) ?? 0) - e.amount);
  return out;
}

export interface RankableRow {
  player_id: string | null;
  stack: number | null;
}

/** Add escrowed stakes back and re-rank. Ties share a rank, matching the view's
 *  `rank() over (order by stack desc)` — on a level board everyone really is first,
 *  and leaderFrom() depends on that staying true to report a tie instead of crowning
 *  whoever sorted first. */
export function withOpenStakes<T extends RankableRow>(rows: T[], stakes: Map<string, number>): Array<T & { stack: number; rank: number }> {
  const adjusted = rows.map((r) => ({
    ...r,
    stack: (r.stack ?? 0) + (r.player_id ? (stakes.get(r.player_id) ?? 0) : 0),
  }));
  adjusted.sort((a, b) => b.stack - a.stack);
  let rank = 0;
  let prev: number | null = null;
  return adjusted.map((r, i) => {
    if (prev === null || r.stack !== prev) rank = i + 1;
    prev = r.stack;
    return { ...r, rank };
  });
}
