import { describe, expect, it } from "vitest";
import { phaseOf, tally } from "./tally";

const v = (...idx: number[]) => idx.map((option_index) => ({ option_index }));

describe("tally", () => {
  it("counts and gives whole percentages that sum to 100", () => {
    const t = tally(v(0, 0, 1, 2, 2, 2), 3);
    expect(t.counts).toEqual([2, 1, 3]);
    expect(t.percents.reduce((a, b) => a + b, 0)).toBe(100);
    expect(t.percents).toEqual([33, 17, 50]);
  });
  it("splits a three-way tie 34/33/33, not 33/33/33", () => {
    expect(tally(v(0, 1, 2), 3).percents).toEqual([34, 33, 33]);
  });
  it("is all zeros with no votes and ignores an out-of-range option", () => {
    expect(tally([], 2)).toEqual({ counts: [0, 0], percents: [0, 0], total: 0 });
    expect(tally(v(0, 7), 2).total).toBe(1);
  });
});

describe("phaseOf", () => {
  const p = { opens_at: "2026-09-20T12:00:00Z", closes_at: "2026-09-22T12:00:00Z", closed_at: null };
  it("is upcoming, open, then closed by the clock, or closed early by hand", () => {
    expect(phaseOf(p, new Date("2026-09-20T11:00:00Z"))).toBe("upcoming");
    expect(phaseOf(p, new Date("2026-09-21T11:00:00Z"))).toBe("open");
    expect(phaseOf(p, new Date("2026-09-22T12:00:00Z"))).toBe("closed");
    expect(phaseOf({ ...p, closed_at: "2026-09-21T00:00:00Z" }, new Date("2026-09-21T11:00:00Z"))).toBe("closed");
  });
});
