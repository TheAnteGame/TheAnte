import { describe, expect, it } from "vitest";
import {
  anteForWeek,
  computeMedian,
  formatMultiplier,
  houseLimit,
  multiplierFor,
  potSplitForCount,
  profitFor,
} from "@/lib/engine";

describe("ante tiers (§2)", () => {
  it("matches the rulebook table", () => {
    expect(anteForWeek(1)).toBe(10);
    expect(anteForWeek(4)).toBe(10);
    expect(anteForWeek(5)).toBe(15);
    expect(anteForWeek(9)).toBe(15);
    expect(anteForWeek(10)).toBe(20);
    expect(anteForWeek(14)).toBe(20);
    expect(anteForWeek(15)).toBe(30);
    expect(anteForWeek(18)).toBe(30);
  });
  it("totals 335 over a season — two-thirds of a starting stack (§2)", () => {
    let total = 0;
    for (let w = 1; w <= 18; w++) total += anteForWeek(w);
    expect(total).toBe(335);
  });
});

describe("the median (§14, acceptance test 34)", () => {
  it("rounds down to the nearest 10 for odd counts too", () => {
    expect(computeMedian([505, 480, 466])).toBe(480);
    expect(computeMedian([505, 483, 466])).toBe(480);
  });
  it("averages the middle two first when even, then floors", () => {
    expect(computeMedian([400, 480, 490, 600])).toBe(480); // (480+490)/2 = 485 → 480
    expect(computeMedian([400, 470, 480, 600])).toBe(470); // 475 → 470
  });
  it("handles the empty league", () => {
    expect(computeMedian([])).toBe(0);
  });
});

describe("the house limit (§4 worked table, median 480 → limit base 160)", () => {
  const median = 480;
  it.each([
    [1400, 160],
    [700, 160],
    [480, 160],
    [300, 100],
    [150, 50],
  ])("stack %i (post-ante) → limit %i", (stack, limit) => {
    expect(houseLimit(stack, median)).toBe(limit);
  });

  it("acceptance test 19: stack 90 in a 30-ante week computes from 60, not 90", () => {
    expect(houseLimit(90 - 30, 480)).toBe(20); // floor(60/3 → 20 → to 10) = 20
  });
});

describe("payouts (§5 worked table)", () => {
  it.each([
    // [with, against, num, den, display]
    [1, 4, 5, 2, "2.50×"], // capped from 4.0
    [3, 2, 2, 3, "0.67×"],
    [3, 6, 2, 1, "2.00×"],
    [6, 3, 1, 2, "0.50×"],
    [7, 15, 15, 7, "2.14×"],
    [15, 7, 7, 15, "0.47×"],
  ])("with %i against %i → %i/%i (%s)", (w, a, num, den, display) => {
    const m = multiplierFor(w, a);
    expect(m).toEqual({ num, den });
    expect(formatMultiplier(m)).toBe(display);
  });

  it("nobody on the other side settles at even money (§5)", () => {
    expect(multiplierFor(4, 0)).toEqual({ num: 1, den: 1 });
  });

  it("the floor binds: deep chalk never pays under 0.25×", () => {
    expect(multiplierFor(20, 1)).toEqual({ num: 1, den: 4 });
  });

  it("with-count can never be zero — you count yourself", () => {
    expect(() => multiplierFor(0, 3)).toThrow();
  });

  it("payouts floor to whole chips; the remainder is the Pot's (§14)", () => {
    // 30 chips at 5/7 (≈0.714×) → 21.42 → 21
    expect(profitFor(30, { num: 5, den: 7 })).toBe(21);
    // Bet 30 at 2.5× → 75 exactly (§5 example)
    expect(profitFor(30, { num: 5, den: 2 })).toBe(75);
    // Bet 30 at 0.5× → 15 (§5 example)
    expect(profitFor(30, { num: 1, den: 2 })).toBe(15);
  });
});

describe("pot places (§7)", () => {
  it.each([
    [8, [100]],
    [15, [100]],
    [16, [67, 33]],
    [23, [67, 33]],
    [24, [50, 33, 17]],
    [32, [40, 30, 20, 10]],
    [40, [33, 27, 20, 13, 7]],
    [55, [33, 27, 20, 13, 7]],
  ])("%i players → %j", (count, split) => {
    expect(potSplitForCount(count)).toEqual(split);
  });
});
