import { describe, expect, it } from "vitest";
import { weekParts } from "./weekParts";

const e = (kind: string, amount: number) => ({ kind, amount });

describe("weekParts", () => {
  it("explains the +231 week that started all this", () => {
    // Real Week 1 shape: ante, five bets, and a Pot.
    const p = weekParts([
      e("ante", -10),
      e("bet_stake", -80),
      e("bet_return", 60),
      e("bet_payout", 81),
      e("pot_award", 180),
    ]);
    expect(p).toEqual({ bets: 61, ante: -10, pot: 180, other: 0, total: 231 });
    expect(p.bets + p.ante + p.pot + p.other).toBe(p.total);
  });

  it("collapses a bet's three entries into one signed number", () => {
    // Won 10 at even money: stake out, stake back, profit.
    expect(weekParts([e("bet_stake", -10), e("bet_return", 10), e("bet_payout", 10)]).bets).toBe(10);
    // Lost 10: the stake goes and nothing comes back.
    expect(weekParts([e("bet_stake", -10)]).bets).toBe(-10);
  });

  it("nets a shove week's ante charge against its refund", () => {
    expect(weekParts([e("ante", -15), e("ante_refund", 15)]).ante).toBe(0);
  });

  it("keeps the rare movements visible rather than folding them into bets", () => {
    const p = weekParts([e("ante", -10), e("felt_floor", 1), e("correction", 25), e("fold_penalty", -50)]);
    expect(p.other).toBe(-24);
    expect(p.bets).toBe(0);
    expect(p.total).toBe(-34);
  });

  it("is all zeros for a week with nothing in it", () => {
    expect(weekParts([])).toEqual({ bets: 0, ante: 0, pot: 0, other: 0, total: 0 });
  });
});
