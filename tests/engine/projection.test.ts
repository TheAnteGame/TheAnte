import { describe, expect, it } from "vitest";
import { projectWeek, type ProjectionOutcome, type ProjectionTicket } from "@/lib/engine/projection";
import { multiplierFor, profitFor } from "@/lib/engine";

// The weekend projection must agree with settleWeek. A player told they are up 80 on
// Sunday and down 20 on Monday stops trusting the ledger, so these pin the rules the
// projection shares with settlement: the stake comes back on a win AND the profit is
// paid, flooring is per bet, a loss costs the full stake, a void or a tie returns it,
// a shove is even money, and an undecided game is neither won nor lost.

const bet = (gameId: string, side: "away" | "home", chips: number) => ({ gameId, side, chips });
const outcomes = (o: Record<string, ProjectionOutcome>) => new Map(Object.entries(o));

describe("projectWeek", () => {
  it("carries an undecided game as at risk, neither won nor lost", () => {
    const tickets: ProjectionTicket[] = [{ playerId: "a", isShove: false, bets: [bet("g1", "away", 20)] }];
    const p = projectWeek({ tickets, outcomes: new Map() }).get("a")!;
    expect(p).toMatchObject({ profit: 0, lost: 0, atRisk: 20, returnable: 20, decided: 0, total: 1 });
  });

  it("pays stake back AND profit on a win, exactly as settlement posts them", () => {
    // One bettor against three: 3/1 clamps to the 2.50x cap, so 20 pays 50 profit.
    const tickets: ProjectionTicket[] = [
      { playerId: "a", isShove: false, bets: [bet("g1", "away", 20)] },
      { playerId: "b", isShove: false, bets: [bet("g1", "home", 10)] },
      { playerId: "c", isShove: false, bets: [bet("g1", "home", 10)] },
      { playerId: "d", isShove: false, bets: [bet("g1", "home", 10)] },
    ];
    const res = projectWeek({ tickets, outcomes: outcomes({ g1: { kind: "final", winner: "away" } }) });
    expect(res.get("a")).toMatchObject({ profit: 50, lost: 0, returnable: 20, atRisk: 0, decided: 1 });
    // The three who were wrong lose the full stake and get nothing back.
    expect(res.get("b")).toMatchObject({ profit: 0, lost: 10, returnable: 0, atRisk: 0 });
  });

  it("loses the FULL stake on a losing bet, whatever it would have paid (§5)", () => {
    const tickets: ProjectionTicket[] = [
      { playerId: "a", isShove: false, bets: [bet("g1", "away", 50)] },
      { playerId: "b", isShove: false, bets: [bet("g1", "home", 10)] },
    ];
    const res = projectWeek({ tickets, outcomes: outcomes({ g1: { kind: "final", winner: "home" } }) });
    expect(res.get("a")).toMatchObject({ profit: 0, lost: 50, returnable: 0 });
  });

  it("returns the stake on a tie and on a void, and pays no profit", () => {
    const tickets: ProjectionTicket[] = [
      { playerId: "a", isShove: false, bets: [bet("g1", "away", 30), bet("g2", "home", 30)] },
      { playerId: "b", isShove: false, bets: [bet("g1", "home", 10), bet("g2", "away", 10)] },
    ];
    const res = projectWeek({
      tickets,
      outcomes: outcomes({ g1: { kind: "final", winner: "tie" }, g2: { kind: "void", reason: "cancelled" } }),
    });
    expect(res.get("a")).toMatchObject({ profit: 0, lost: 0, returnable: 60, atRisk: 0, decided: 2 });
  });

  it("pays a shove even money, never the crowd price (§8)", () => {
    // Alone against four would be the 2.50x cap for anyone else. A shover gets 1.00x.
    const tickets: ProjectionTicket[] = [
      { playerId: "shover", isShove: true, bets: [bet("g1", "away", 480)] },
      ...["b", "c", "d", "e"].map((id) => ({ playerId: id, isShove: false, bets: [bet("g1", "home", 10)] })),
    ];
    const res = projectWeek({ tickets, outcomes: outcomes({ g1: { kind: "final", winner: "away" } }) });
    expect(res.get("shover")).toMatchObject({ profit: 480, returnable: 480 });
  });

  it("floors every bet separately, never the sum", () => {
    // Three bettors one side, one the other: 1/3 each. floor(10/3) = 3, three times.
    const tickets: ProjectionTicket[] = [
      { playerId: "a", isShove: false, bets: [bet("g1", "home", 10), bet("g2", "home", 10), bet("g3", "home", 10)] },
      ...["b", "c"].flatMap((id) => [{ playerId: id, isShove: false, bets: [bet("g1", "home", 10), bet("g2", "home", 10), bet("g3", "home", 10)] }]),
      { playerId: "z", isShove: false, bets: [bet("g1", "away", 10), bet("g2", "away", 10), bet("g3", "away", 10)] },
    ];
    const res = projectWeek({
      tickets,
      outcomes: outcomes({
        g1: { kind: "final", winner: "home" },
        g2: { kind: "final", winner: "home" },
        g3: { kind: "final", winner: "home" },
      }),
    });
    expect(res.get("a")!.profit).toBe(9); // 3 + 3 + 3, not floor(30/3) = 10
  });

  it("agrees bet-by-bet with multiplierFor and profitFor on a mixed ticket", () => {
    const tickets: ProjectionTicket[] = [
      { playerId: "a", isShove: false, bets: [bet("g1", "away", 30), bet("g2", "home", 20), bet("g3", "away", 10)] },
      { playerId: "b", isShove: false, bets: [bet("g1", "home", 10), bet("g2", "home", 10)] },
      { playerId: "c", isShove: false, bets: [bet("g1", "home", 10), bet("g3", "home", 10)] },
    ];
    const res = projectWeek({
      tickets,
      outcomes: outcomes({
        g1: { kind: "final", winner: "away" }, // a alone vs b,c  -> 2/1
        g2: { kind: "final", winner: "home" }, // a,b together, none against -> 1/1
        g3: { kind: "pending" },
      }),
    });
    const byHand = profitFor(30, multiplierFor(1, 2)) + profitFor(20, multiplierFor(2, 0));
    expect(res.get("a")).toMatchObject({ profit: byHand, lost: 0, atRisk: 10, decided: 2, total: 3 });
  });

  it("a fold has no bets and therefore no projection movement", () => {
    const res = projectWeek({ tickets: [{ playerId: "a", isShove: false, bets: [] }], outcomes: new Map() });
    expect(res.get("a")).toMatchObject({ profit: 0, lost: 0, atRisk: 0, returnable: 0, decided: 0, total: 0 });
  });

  it("treats a game flagged final with no usable outcome as still pending", () => {
    // The loader maps a scoreless 'final' to pending rather than guessing a winner.
    const tickets: ProjectionTicket[] = [{ playerId: "a", isShove: false, bets: [bet("g1", "away", 40)] }];
    const res = projectWeek({ tickets, outcomes: outcomes({ g1: { kind: "pending" } }) });
    expect(res.get("a")).toMatchObject({ atRisk: 40, decided: 0 });
  });
});
