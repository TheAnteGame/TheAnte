import { describe, expect, it } from "vitest";
import { playerDials, type ProfileTicket } from "./player";

const bet = (chips: number, multiplier: number | null = 1, result: string | null = "won") => ({
  chips,
  multiplier,
  result,
  payout: null,
});
const live = (week: number, ...bets: ReturnType<typeof bet>[]): ProfileTicket => ({ week, isFold: false, isShove: false, bets });
const fold = (week: number): ProfileTicket => ({ week, isFold: true, isShove: false, bets: [] });
const shove = (week: number, chips: number): ProfileTicket => ({ week, isFold: false, isShove: true, bets: [bet(chips, 1)] });

describe("playerDials", () => {
  it("reads width and weight off live tickets", () => {
    const d = playerDials([live(1, bet(10), bet(20), bet(30)), live(2, bet(50), bet(50))]);
    expect(d.avgGames).toBe(2.5);
    expect(d.avgChips).toBe(32);
    expect(d.biggestBet).toBe(50);
    expect(d.totalStaked).toBe(160);
  });

  it("keeps a fold out of the averages but counts the week", () => {
    const d = playerDials([live(1, bet(10), bet(10)), fold(2)]);
    expect(d.weeksPlayed).toBe(2);
    expect(d.weeksFolded).toBe(1);
    // Two games over ONE live ticket, not two.
    expect(d.avgGames).toBe(2);
  });

  it("keeps a shove out of width and weight — it is one forced all-in, not a style", () => {
    const d = playerDials([live(1, bet(10), bet(10)), shove(2, 400)]);
    expect(d.weeksShoved).toBe(1);
    expect(d.avgGames).toBe(2);
    expect(d.avgChips).toBe(10);
    // It still counts as real chips at risk.
    expect(d.totalStaked).toBe(420);
    expect(d.biggestBet).toBe(400);
  });

  it("weights the multiplier by chips, so a big contrarian bet outweighs a token one", () => {
    const d = playerDials([live(1, bet(50, 2.5), bet(10, 0.5))]);
    // (2.5*50 + 0.5*10) / 60 = 2.17, not the flat mean of 1.5
    expect(d.avgMultiplier).toBe(2.17);
  });

  it("ignores bets that never priced", () => {
    const d = playerDials([live(1, bet(50, 2.0), bet(50, null, "returned"), bet(50, 1.0, "void"))]);
    expect(d.avgMultiplier).toBe(2);
  });

  it("is null rather than zero before anybody has bet", () => {
    const d = playerDials([fold(1)]);
    expect(d.avgGames).toBeNull();
    expect(d.avgChips).toBeNull();
    expect(d.avgMultiplier).toBeNull();
    expect(d.biggestBet).toBeNull();
  });

  it("counts wins and losses across every ticket", () => {
    const d = playerDials([live(1, bet(10, 1, "won"), bet(10, 1, "lost")), shove(2, 100)]);
    expect(d.betsWon).toBe(2);
    expect(d.betsLost).toBe(1);
  });
});
