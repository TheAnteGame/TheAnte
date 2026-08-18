import { describe, expect, it } from "vitest";
import { championshipOrder, computeAwards, finishedOnFelt } from "@/lib/engine/awards";
import type { AwardsInput } from "@/lib/engine/awards";

const base = (over: Partial<AwardsInput>): AwardsInput => ({
  players: [],
  tickets: [],
  bets: [],
  weeklyGains: [],
  potsWon: [],
  weeksPlayed: [1, 2, 3],
  ...over,
});

describe("season awards (§12)", () => {
  it("Iron Stack goes only to players with zero folds — forgetting counts", () => {
    const input = base({
      players: [
        { id: "a", status: "approved", finalStack: 600, everOnFelt: false },
        { id: "b", status: "approved", finalStack: 400, everOnFelt: false },
      ],
      tickets: [
        { week: 1, playerId: "a", isFold: false, isShove: false, submittedAtMs: 100 },
        { week: 1, playerId: "b", isFold: true, isShove: false, submittedAtMs: 999 }, // auto-fold
      ],
    });
    expect(computeAwards(input).iron_stack?.playerIds).toEqual(["a"]);
  });

  it("Contrarian counts winning bets at 2.00×+ and never counts a shove", () => {
    const input = base({
      players: [{ id: "a", status: "approved", finalStack: 500, everOnFelt: false }],
      bets: [
        { playerId: "a", week: 1, chips: 10, multiplier: 2.5, result: "won", isShove: false },
        { playerId: "a", week: 2, chips: 10, multiplier: 2.0, result: "won", isShove: false },
        { playerId: "a", week: 3, chips: 400, multiplier: 1.0, result: "won", isShove: true }, // excluded (§12)
      ],
    });
    expect(computeAwards(input).contrarian).toEqual({ playerIds: ["a"], detail: "2 winning bets at 2.00× or better" });
  });

  it("Chalk Eater is chip-weighted, not bet-weighted", () => {
    const input = base({
      players: [
        { id: "a", status: "approved", finalStack: 500, everOnFelt: false },
        { id: "b", status: "approved", finalStack: 500, everOnFelt: false },
      ],
      bets: [
        // a: one big chalk bet, one small fade → 50/60 chalk by chips
        { playerId: "a", week: 1, chips: 50, multiplier: 0.5, result: "lost", isShove: false },
        { playerId: "a", week: 1, chips: 10, multiplier: 2.0, result: "won", isShove: false },
        // b: two small chalk, one big fade → 20/70 chalk by chips
        { playerId: "b", week: 1, chips: 10, multiplier: 0.5, result: "won", isShove: false },
        { playerId: "b", week: 1, chips: 10, multiplier: 0.9, result: "lost", isShove: false },
        { playerId: "b", week: 1, chips: 50, multiplier: 2.2, result: "lost", isShove: false },
      ],
    });
    expect(computeAwards(input).chalk_eater?.playerIds).toEqual(["a"]);
  });

  it("Worst Shove is the largest LOST shove; the Straus climbed back above 500", () => {
    const input = base({
      players: [
        { id: "s", status: "approved", finalStack: 640, everOnFelt: true },
        { id: "w", status: "approved", finalStack: 1, everOnFelt: true },
      ],
      bets: [{ playerId: "w", week: 9, chips: 380, multiplier: 1.0, result: "lost", isShove: true }],
    });
    const awards = computeAwards(input);
    expect(awards.worst_shove?.playerIds).toEqual(["w"]);
    expect(awards.straus?.playerIds).toEqual(["s"]);
  });

  it("the Straggler counts last-to-submit weeks; deactivated players win nothing", () => {
    const input = base({
      players: [
        { id: "slow", status: "approved", finalStack: 500, everOnFelt: false },
        { id: "fast", status: "approved", finalStack: 500, everOnFelt: false },
        { id: "quit", status: "deactivated", finalStack: 900, everOnFelt: false },
      ],
      weeksPlayed: [1, 2],
      tickets: [
        { week: 1, playerId: "fast", isFold: false, isShove: false, submittedAtMs: 10 },
        { week: 1, playerId: "slow", isFold: false, isShove: false, submittedAtMs: 99 },
        { week: 1, playerId: "quit", isFold: false, isShove: false, submittedAtMs: 500 }, // ineligible
        { week: 2, playerId: "fast", isFold: false, isShove: false, submittedAtMs: 10 },
        { week: 2, playerId: "slow", isFold: true, isShove: false, submittedAtMs: 999 }, // auto-fold = latest
      ],
      weeklyGains: [{ playerId: "quit", week: 1, gain: 400 }], // also excluded from Best Week
    });
    const awards = computeAwards(input);
    expect(awards.straggler?.playerIds).toEqual(["slow"]);
    expect(awards.best_week).toBeUndefined();
  });
});

describe("championship order (§11)", () => {
  it("applies tiebreakers in order and pushes deactivated players out of contention", () => {
    const order = championshipOrder([
      { playerId: "quit", stack: 2000, winningBets: 50, potsWon: 5, weeksFolded: 0, eligible: false },
      { playerId: "a", stack: 900, winningBets: 30, potsWon: 2, weeksFolded: 1, eligible: true },
      { playerId: "b", stack: 900, winningBets: 30, potsWon: 2, weeksFolded: 0, eligible: true },
      { playerId: "c", stack: 900, winningBets: 31, potsWon: 0, weeksFolded: 4, eligible: true },
    ]);
    // c wins tiebreaker 1 (winning bets); then b beats a on fewest folds; quit is last despite the stack.
    expect(order.map((s) => s.playerId)).toEqual(["c", "b", "a", "quit"]);
  });
});

describe("The Mark's electorate (§12)", () => {
  it("is everyone who finished below one Week 18 ante", () => {
    expect(finishedOnFelt(29)).toBe(true);
    expect(finishedOnFelt(30)).toBe(false);
  });
});
