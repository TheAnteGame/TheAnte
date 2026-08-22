// Who, if anyone, is leading (ADMIN §4.5.3).
//
// The standings view ranks with `rank() over (order by stack desc)`, so when the room is
// level EVERY player is rank 1. The rail used to read rank-1 with limit(1), which handed
// it an arbitrary row and announced "Steven leads with 500" on a preseason board where
// all 25 players held exactly 500. Nobody led. The rail said someone did.
//
// A tie at the top is the normal state of Week 1, not an edge case, so it gets said out
// loud rather than papered over with whoever the planner happened to return first.

export interface StandingRow {
  first_name: string | null;
  last_name: string | null;
  stack: number | null;
  status: string;
}

export type LeaderState =
  | { kind: "none" }
  | { kind: "leader"; name: string; stack: number }
  | { kind: "tied"; count: number; stack: number };

function shortName(r: StandingRow): string {
  return `${r.first_name ?? ""} ${(r.last_name ?? "").slice(0, 1)}.`.trim() || "—";
}

/** Pass every standings row; only approved players can lead (a deactivated player keeps
 *  their chips but has left the room, §13). */
export function leaderFrom(rows: StandingRow[]): LeaderState {
  const live = rows.filter((r) => r.status === "approved" && r.stack !== null);
  if (live.length === 0) return { kind: "none" };

  const top = Math.max(...live.map((r) => r.stack as number));
  const atTop = live.filter((r) => r.stack === top);

  // One player clear of the field — the only case where a name belongs on the rail.
  if (atTop.length === 1) return { kind: "leader", name: shortName(atTop[0]), stack: top };
  return { kind: "tied", count: atTop.length, stack: top };
}
