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
