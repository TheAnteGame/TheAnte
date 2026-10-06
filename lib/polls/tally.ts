// Poll arithmetic (D-095), pure. Percentages are whole numbers that sum to 100 by
// largest-remainder, so a bar chart never reads 33/33/33 with a chip left over.

export interface Tally {
  counts: number[];
  percents: number[];
  total: number;
}

export function tally(votes: Array<{ option_index: number }>, optionCount: number): Tally {
  const counts = Array.from({ length: optionCount }, () => 0);
  for (const v of votes) if (v.option_index >= 0 && v.option_index < optionCount) counts[v.option_index]++;
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return { counts, percents: counts.map(() => 0), total };
  const exact = counts.map((c) => (c * 100) / total);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]++;
    left--;
  }
  return { counts, percents: floors, total };
}

export type PollPhase = "upcoming" | "open" | "closed";

export function phaseOf(p: { opens_at: string; closes_at: string; closed_at: string | null }, now = new Date()): PollPhase {
  if (p.closed_at || new Date(p.closes_at) <= now) return "closed";
  if (new Date(p.opens_at) > now) return "upcoming";
  return "open";
}

/** The one-line result for the closing email (D-111). Counts only — a poll's result
 *  never carries a name. A tie is called a tie rather than handed to whichever option
 *  sorts first; no votes says so plainly. */
export function outcomeOf(options: string[], t: Tally): string {
  if (t.total === 0) return "No votes were cast.";
  const top = Math.max(...t.counts);
  const leaders = options.filter((_, i) => t.counts[i] === top);
  const votes = (n: number) => `${n} vote${n === 1 ? "" : "s"}`;
  if (leaders.length === 1) {
    const i = t.counts.indexOf(top);
    return `“${options[i]}” wins, with ${votes(top)} of ${t.total} (${t.percents[i]}%).`;
  }
  const names = leaders.map((l) => `“${l}”`);
  const list = names.length === 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `A tie: ${list}, with ${votes(top)} each.`;
}
