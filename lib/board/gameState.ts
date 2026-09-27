// What state a game is in, and what order the board should read in (D-108).
//
// The board listed every game by kickoff whatever had happened to it, so a finished
// blowout sat above a one-score game still being played, and nothing on the row said
// which was which. Three states, and the order follows attention rather than the
// clock: what is happening now, then what is about to, then what is over.
//
// "Most competitive" is the margin — a live game separated by three points is the
// one worth looking at. It only sorts WITHIN the live block; a close finished game
// does not outrank a kickoff that has not happened yet, because the week is still
// ahead of it.

export type GameState = "live" | "upcoming" | "final" | "void";

export interface BoardGame {
  status: string;
  awayScore: number | null;
  homeScore: number | null;
  kickoffAt: string;
  voidReason?: string | null;
}

const RANK: Record<GameState, number> = { live: 0, upcoming: 1, final: 2, void: 3 };

export function stateOf(g: Pick<BoardGame, "status" | "voidReason">): GameState {
  if (g.voidReason || g.status === "cancelled" || g.status === "postponed") return "void";
  if (g.status === "final") return "final";
  if (g.status === "in_progress") return "live";
  return "upcoming";
}

/** Points between the sides, or null when the game has no score to speak of. */
export function marginOf(g: Pick<BoardGame, "awayScore" | "homeScore">): number | null {
  if (g.awayScore === null || g.homeScore === null) return null;
  return Math.abs(g.awayScore - g.homeScore);
}

export function orderBoard<T extends BoardGame>(games: T[]): T[] {
  return [...games].sort((a, b) => {
    const sa = stateOf(a);
    const sb = stateOf(b);
    if (RANK[sa] !== RANK[sb]) return RANK[sa] - RANK[sb];
    if (sa === "live") {
      // Closest first; a live game with no score yet sits behind ones that have one.
      const ma = marginOf(a);
      const mb = marginOf(b);
      if (ma !== mb) {
        if (ma === null) return 1;
        if (mb === null) return -1;
        return ma - mb;
      }
    }
    return a.kickoffAt.localeCompare(b.kickoffAt);
  });
}
