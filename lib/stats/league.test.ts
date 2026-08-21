import { describe, expect, it } from "vitest";
import {
  headToHead,
  leagueHighlights,
  playerTendencies,
  type StatBet,
  type StatTicket,
  type WeeklyGain,
} from "./league";

const bet = (o: Partial<StatBet> & Pick<StatBet, "playerId" | "week">): StatBet => ({
  chips: 20, multiplier: 1, result: "won", isShove: false, team: "KC", ...o,
});

describe("playerTendencies", () => {
  const tickets: StatTicket[] = [
    { playerId: "a", week: 1, isFold: false },
    { playerId: "a", week: 2, isFold: true },
    { playerId: "b", week: 1, isFold: false },
  ];
  const gains: WeeklyGain[] = [
    { playerId: "a", week: 1, gain: 60 },
    { playerId: "a", week: 2, gain: -10 },
    { playerId: "b", week: 1, gain: -25 },
  ];

  it("counts only decided bets in the record", () => {
    const bets = [
      bet({ playerId: "a", week: 1, result: "won" }),
      bet({ playerId: "a", week: 1, result: "lost" }),
      bet({ playerId: "a", week: 1, result: "returned" }),
      bet({ playerId: "a", week: 1, result: "void" }),
    ];
    const [a] = playerTendencies(["a"], bets, tickets, gains);
    expect(a.decided).toBe(2);
    expect(a.won).toBe(1);
    expect(a.winPct).toBe(50);
  });

  it("measures chalk by CHIPS on the popular side, matching the §12 award", () => {
    const bets = [
      // 60 chips at 0.50x — with the crowd. 20 at 2.5x — against it.
      bet({ playerId: "a", week: 1, chips: 60, multiplier: 0.5, result: "lost" }),
      bet({ playerId: "a", week: 1, chips: 20, multiplier: 2.5, result: "won" }),
    ];
    const [a] = playerTendencies(["a"], bets, tickets, gains);
    expect(a.chalkShare).toBeCloseTo(0.75);
    expect(a.bigPriceWins).toBe(1);
  });

  it("treats a missing multiplier as even money, not as chalk", () => {
    const bets = [bet({ playerId: "a", week: 1, chips: 10, multiplier: null, result: "won" })];
    const [a] = playerTendencies(["a"], bets, tickets, gains);
    expect(a.chalkShare).toBe(0);
  });

  it("reports the best week and ignores losing weeks", () => {
    const [a] = playerTendencies(["a"], [], tickets, gains);
    expect(a.bestWeek).toEqual({ week: 1, gain: 60 });
  });

  it("returns no best week when every week is negative", () => {
    const [b] = playerTendencies(["b"], [], tickets, gains);
    expect(b.bestWeek).toBeNull();
  });

  it("counts folds", () => {
    const [a] = playerTendencies(["a"], [], tickets, gains);
    expect(a.folds).toBe(1);
  });

  it("finds the most-backed team across all bets, decided or not", () => {
    const bets = [
      bet({ playerId: "a", week: 1, team: "KC" }),
      bet({ playerId: "a", week: 2, team: "KC" }),
      bet({ playerId: "a", week: 2, team: "BUF", result: "returned" }),
    ];
    const [a] = playerTendencies(["a"], bets, tickets, gains);
    expect(a.favourite).toEqual({ team: "KC", times: 2 });
  });

  it("survives a player with no history at all", () => {
    const [z] = playerTendencies(["z"], [], [], []);
    expect(z.decided).toBe(0);
    expect(z.chalkShare).toBeNull();
    expect(z.avgMultiplier).toBeNull();
    expect(z.favourite).toBeNull();
  });
});

describe("leagueHighlights", () => {
  const gains: WeeklyGain[] = [
    { playerId: "a", week: 1, gain: 40 },
    { playerId: "b", week: 1, gain: -20 },
    { playerId: "a", week: 2, gain: 90 },
    { playerId: "b", week: 2, gain: 15 },
  ];

  it("reads the most recent week, not the whole season", () => {
    const h = leagueHighlights([], gains);
    expect(h.biggestWeek).toEqual({ value: 90, playerId: "a", week: 2 });
  });

  it("picks the highest price actually cashed", () => {
    const bets = [
      bet({ playerId: "a", week: 2, multiplier: 2.5, result: "won", team: "NYJ" }),
      bet({ playerId: "b", week: 2, multiplier: 1.2, result: "won" }),
      bet({ playerId: "b", week: 2, multiplier: 3, result: "lost" }), // lost: not cashed
    ];
    const h = leagueHighlights(bets, gains);
    expect(h.bestPrice?.value.multiplier).toBe(2.5);
    expect(h.bestPrice?.value.team).toBe("NYJ");
  });

  it("excludes a shove from best price — a shove is always even money (§8)", () => {
    const bets = [
      bet({ playerId: "a", week: 2, multiplier: 1, result: "won", isShove: true, chips: 490 }),
      bet({ playerId: "b", week: 2, multiplier: 1.5, result: "won" }),
    ];
    expect(leagueHighlights(bets, gains).bestPrice?.value.multiplier).toBe(1.5);
  });

  it("names the team the most people lost on, and never a player", () => {
    const bets = [
      bet({ playerId: "a", week: 2, result: "lost", team: "DAL" }),
      bet({ playerId: "b", week: 2, result: "lost", team: "DAL" }),
      bet({ playerId: "c", week: 2, result: "lost", team: "SF" }),
    ];
    const h = leagueHighlights(bets, gains);
    expect(h.coldestTake?.value).toEqual({ team: "DAL", backers: 2 });
    expect(h.coldestTake).not.toHaveProperty("playerId");
  });

  it("counts a hot hand only as consecutive positive weeks ending now", () => {
    const broken: WeeklyGain[] = [
      { playerId: "a", week: 1, gain: 10 },
      { playerId: "a", week: 2, gain: -5 },
      { playerId: "a", week: 3, gain: 10 },
    ];
    expect(leagueHighlights([], broken).hotHand?.value).toBe(1);
  });

  it("returns nothing at all before a week has settled", () => {
    const h = leagueHighlights([], []);
    expect(h).toEqual({ biggestWeek: null, bestPrice: null, coldestTake: null, hotHand: null });
  });
});

describe("headToHead", () => {
  const gains: WeeklyGain[] = [
    { playerId: "me", week: 1, gain: 40 },
    { playerId: "rival", week: 1, gain: 10 },
    { playerId: "me", week: 2, gain: -20 },
    { playerId: "rival", week: 2, gain: 5 },
    { playerId: "me", week: 3, gain: 30 },
    { playerId: "rival", week: 3, gain: 30 },
    // Joined late — weeks 1 and 2 must not be scored against them.
    { playerId: "latecomer", week: 3, gain: 90 },
  ];

  it("scores a week to whoever gained more", () => {
    const [rival] = headToHead("me", gains).filter((r) => r.opponentId === "rival");
    expect(rival).toMatchObject({ won: 1, lost: 1, tied: 1, weeks: 3 });
  });

  it("only counts weeks both players actually played", () => {
    const late = headToHead("me", gains).find((r) => r.opponentId === "latecomer");
    expect(late).toMatchObject({ won: 0, lost: 1, weeks: 1 });
  });

  it("never scores a player against themselves", () => {
    expect(headToHead("me", gains).some((r) => r.opponentId === "me")).toBe(false);
  });

  it("is symmetric — my win is their loss", () => {
    const mine = headToHead("me", gains).find((r) => r.opponentId === "rival")!;
    const theirs = headToHead("rival", gains).find((r) => r.opponentId === "me")!;
    expect(theirs.won).toBe(mine.lost);
    expect(theirs.lost).toBe(mine.won);
    expect(theirs.tied).toBe(mine.tied);
  });

  it("returns nothing for a player with no shared weeks", () => {
    expect(headToHead("ghost", gains)).toEqual([]);
  });
});
