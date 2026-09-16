// The standings as they appear in the week-open email (D-085). Every approved player,
// ranked the way the site's `standings` view ranks — SQL rank(): equal stacks share a
// place and the next place is skipped (1, 1, 3). Pure so it can be tested; the job
// only supplies stacks, deltas and names.

export interface LeaderRow {
  id: string;
  rank: string;
  name: string;
  stack: string;
  delta: string;
}

const signed = (n: number) => (n >= 0 ? "+" : "-") + Math.abs(n);

export function emailStandings(
  rows: Array<{ id: string; name: string; stack: number; delta: number }>,
): { leaders: LeaderRow[]; rankOf: Map<string, string> } {
  const sorted = [...rows].sort((a, b) => b.stack - a.stack || a.name.localeCompare(b.name));
  const leaders: LeaderRow[] = [];
  const rankOf = new Map<string, string>();
  let place = 0;
  sorted.forEach((r, i) => {
    if (i === 0 || r.stack !== sorted[i - 1].stack) place = i + 1;
    const rank = String(place);
    leaders.push({ id: r.id, rank, name: r.name, stack: String(r.stack), delta: signed(r.delta) });
    rankOf.set(r.id, rank);
  });
  return { leaders, rankOf };
}
