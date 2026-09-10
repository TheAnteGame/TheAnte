import { describe, expect, it } from "vitest";

// The Pot as players see it (D-070). The rule under test is small but it was wrong on
// a live board: the Pot's ledger account is ALSO the escrow that holds every stake
// between the reveal and settlement, so summing the account reads correctly all week
// and then lies for four days. Week 1 showed 1430 when the Pot was 150.
//
// This mirrors lib/stats/pot.ts's reducer exactly. Kept pure and here rather than
// behind a database so the RULE is pinned, not the plumbing.

interface Row { kind: string; amount: number; week_id: string | null }

const potBalance = (rows: Row[], unsettled: Set<string>) =>
  rows.reduce((s, e) => s + (e.kind === "bet_stake" && e.week_id && unsettled.has(e.week_id) ? 0 : e.amount), 0);

const W1 = "w1";
const W2 = "w2";

describe("potBalance — the account, less stakes still in escrow", () => {
  it("is antes only before the reveal, when no stake has been posted", () => {
    const rows: Row[] = Array.from({ length: 15 }, () => ({ kind: "ante", amount: 10, week_id: W1 }));
    expect(potBalance(rows, new Set([W1]))).toBe(150);
  });

  it("EXCLUDES stakes held in escrow — the exact 2026 Week 1 failure", () => {
    // 15 antes plus the pot side of the reveal's bet_stake. The band read 1430.
    const rows: Row[] = [
      ...Array.from({ length: 15 }, () => ({ kind: "ante", amount: 10, week_id: W1 })),
      { kind: "bet_stake", amount: 1280, week_id: W1 },
    ];
    expect(potBalance(rows, new Set([W1]))).toBe(150);
  });

  it("COUNTS a settled week's retained stakes — that is the sweep, and it is the Pot", () => {
    // Settled: 1280 staked, 1150 paid back out as returns and payouts. The 130 left
    // behind swept into the Pot and must NOT be subtracted, or the Pot is understated
    // for the rest of the season.
    const rows: Row[] = [
      ...Array.from({ length: 15 }, () => ({ kind: "ante", amount: 10, week_id: W1 })),
      { kind: "bet_stake", amount: 1280, week_id: W1 },
      { kind: "bet_return", amount: -900, week_id: W1 },
      { kind: "bet_payout", amount: -250, week_id: W1 },
    ];
    expect(potBalance(rows, new Set())).toBe(280); // 150 antes + 130 swept
  });

  it("subtracts only the OPEN week's escrow when a settled week sits behind it", () => {
    const rows: Row[] = [
      { kind: "ante", amount: 150, week_id: W1 },
      { kind: "bet_stake", amount: 1280, week_id: W1 },
      { kind: "bet_return", amount: -900, week_id: W1 },
      { kind: "bet_payout", amount: -250, week_id: W1 },
      { kind: "ante", amount: 150, week_id: W2 },
      { kind: "bet_stake", amount: 900, week_id: W2 },
    ];
    // W1 settled (its 130 sweep counts), W2 live (its 900 does not).
    expect(potBalance(rows, new Set([W2]))).toBe(430);
  });

  it("keeps season-level rows that carry no week at all", () => {
    const rows: Row[] = [
      { kind: "ante", amount: 150, week_id: W1 },
      { kind: "correction", amount: 25, week_id: null },
    ];
    expect(potBalance(rows, new Set([W1]))).toBe(175);
  });

  it("never subtracts a player-side kind that merely mentions a live week", () => {
    const rows: Row[] = [
      { kind: "ante", amount: 150, week_id: W1 },
      { kind: "felt_floor", amount: -1, week_id: W1 },
      { kind: "pot_award", amount: -140, week_id: W1 },
    ];
    expect(potBalance(rows, new Set([W1]))).toBe(9);
  });
});

// ── Standings during the revealed window (D-073) ────────────────────────────────
// Mirrors lib/stats/standings.ts's withOpenStakes. The failure it exists for was
// live: on 2026-09-10 the two players who FOLDED led the board on 490 while the
// player who committed the most sat last on 330, because stakes leave the stack at
// the reveal and do not return until settlement.

interface SRow { player_id: string | null; stack: number | null }

const withOpenStakes = (rows: SRow[], stakes: Map<string, number>) => {
  const adj = rows.map((r) => ({ ...r, stack: (r.stack ?? 0) + (r.player_id ? (stakes.get(r.player_id) ?? 0) : 0) }));
  adj.sort((a, b) => b.stack - a.stack);
  let rank = 0, prev: number | null = null;
  return adj.map((r, i) => { if (prev === null || r.stack !== prev) rank = i + 1; prev = r.stack; return { ...r, rank }; });
};

describe("withOpenStakes — a stake in flight is still yours", () => {
  it("stops folders leading the board — the exact 2026 Week 1 failure", () => {
    const rows: SRow[] = [
      { player_id: "kegan", stack: 490 },   // folded, staked nothing
      { player_id: "justin", stack: 330 },  // staked 160, the most in the league
      { player_id: "robert", stack: 410 },  // staked 80
    ];
    const stakes = new Map([["justin", 160], ["robert", 80]]);
    const out = withOpenStakes(rows, stakes);
    // Nothing is settled, so nothing has been decided: everyone is level on 490.
    expect(out.every((r) => r.stack === 490)).toBe(true);
    expect(out.every((r) => r.rank === 1)).toBe(true);
  });

  it("leaves a settled board alone — no open stakes, no adjustment", () => {
    const rows: SRow[] = [{ player_id: "a", stack: 640 }, { player_id: "b", stack: 480 }];
    const out = withOpenStakes(rows, new Map());
    expect(out.map((r) => [r.player_id, r.stack, r.rank])).toEqual([["a", 640, 1], ["b", 480, 2]]);
  });

  it("keeps ties sharing a rank, so leaderFrom can still report a tie", () => {
    const rows: SRow[] = [{ player_id: "a", stack: 500 }, { player_id: "b", stack: 500 }, { player_id: "c", stack: 400 }];
    const out = withOpenStakes(rows, new Map());
    expect(out.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("a real gap survives the adjustment — it does not flatten a genuine lead", () => {
    const rows: SRow[] = [{ player_id: "a", stack: 700 }, { player_id: "b", stack: 300 }];
    const out = withOpenStakes(rows, new Map([["a", 100], ["b", 160]]));
    expect(out.map((r) => [r.player_id, r.stack])).toEqual([["a", 800], ["b", 460]]);
  });
});
