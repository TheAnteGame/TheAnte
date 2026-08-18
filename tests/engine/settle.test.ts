import { describe, expect, it } from "vitest";
import { settleWeek } from "@/lib/engine";
import type { EngineGame, EngineTicket, SettleWeekInput } from "@/lib/engine";

const finalGame = (id: string, winner: "away" | "home" | "tie"): EngineGame => ({
  id,
  outcome: { kind: "final", winner },
});

const ticket = (playerId: string, bets: Array<[string, "away" | "home", number]>): EngineTicket => ({
  playerId,
  isFold: false,
  isShove: false,
  bets: bets.map(([gameId, side, chips]) => ({ gameId, side, chips })),
  committedStake: null,
  pendingRefund: null,
});

const baseInput = (over: Partial<SettleWeekInput>): SettleWeekInput => ({
  weekNumber: 5,
  tickets: [],
  games: [],
  players: [],
  potBalance: 0,
  potSplit: [100],
  ...over,
});

describe("straight-up settlement (§1.5, §5)", () => {
  it("winner wins, loser loses full amount, and the sweep keeps the difference", () => {
    // 3 on away vs 2 on home; away wins. Away side pays 2/3.
    const games = [finalGame("g1", "away")];
    const tickets = [
      ticket("a", [["g1", "away", 30]]),
      ticket("b", [["g1", "away", 10]]),
      ticket("c", [["g1", "away", 50]]),
      ticket("d", [["g1", "home", 50]]),
      ticket("e", [["g1", "home", 20]]),
    ];
    const players = ["a", "b", "c", "d", "e"].map((id) => ({
      id,
      stackPreAnte: 500,
      stackAtReveal: 485 - (tickets.find((t) => t.playerId === id)!.bets[0]?.chips ?? 0),
    }));
    const r = settleWeek(baseInput({ games, tickets, players, potBalance: 75 + 160 })); // antes 75 + stakes 160

    const a = r.bets.find((b) => b.playerId === "a")!;
    expect(a.result).toBe("won");
    expect(a.multiplier).toEqual({ num: 2, den: 3 });
    expect(a.payout).toBe(20); // floor(30 × 2/3)

    const d = r.bets.find((b) => b.playerId === "d")!;
    expect(d.result).toBe("lost");
    expect(d.payout).toBe(0);

    // Sweep: staked 160; returned stakes 90 (winners) + payouts 20+6+33 = 59 → 160−149 = 11
    expect(r.swept).toBe(160 - 90 - 59);
  });

  it("an NFL tie returns chips — neither a win nor a loss (§10)", () => {
    const games = [finalGame("g1", "tie")];
    const tickets = [ticket("a", [["g1", "away", 20]]), ticket("b", [["g1", "home", 40]])];
    const players = [
      { id: "a", stackPreAnte: 500, stackAtReveal: 465 },
      { id: "b", stackPreAnte: 500, stackAtReveal: 445 },
    ];
    const r = settleWeek(baseInput({ games, tickets, players, potBalance: 90 }));
    expect(r.bets.every((b) => b.result === "returned" && b.payout === 0)).toBe(true);
  });

  it("a game rescheduled before the deadline voids; chips return (§10)", () => {
    const games: EngineGame[] = [{ id: "g1", outcome: { kind: "void", reason: "kicked_pre_deadline" } }];
    const tickets = [ticket("a", [["g1", "away", 20]])];
    const players = [{ id: "a", stackPreAnte: 500, stackAtReveal: 465 }];
    const r = settleWeek(baseInput({ games, tickets, players, potBalance: 55 }));
    expect(r.bets[0].result).toBe("void");
  });
});

describe("the shove (§8, §14)", () => {
  const shove = (playerId: string, gameId: string, side: "away" | "home", committed: number, refund: number): EngineTicket => ({
    playerId,
    isFold: false,
    isShove: true,
    bets: [{ gameId, side, chips: committed }],
    committedStake: committed,
    pendingRefund: refund,
  });

  it("a winning shove doubles the pre-ante stack at exactly 1× — never the fade price", () => {
    // Shover alone against 4 — a normal bet would cap at 2.50×; the shove pays 1×.
    const games = [finalGame("g1", "away")];
    const tickets = [
      shove("s", "g1", "away", 400, 15),
      ticket("b", [["g1", "home", 20]]),
      ticket("c", [["g1", "home", 20]]),
      ticket("d", [["g1", "home", 20]]),
      ticket("e", [["g1", "home", 20]]),
    ];
    const players = [
      { id: "s", stackPreAnte: 400, stackAtReveal: 0 }, // −15 ante +15 refund −400 stake
      ...["b", "c", "d", "e"].map((id) => ({ id, stackPreAnte: 500, stackAtReveal: 465 })),
    ];
    const r = settleWeek(baseInput({ games, tickets, players, potBalance: 60 - 15 + 480 }));
    const s = r.bets.find((b) => b.playerId === "s")!;
    expect(s.multiplier).toEqual({ num: 1, den: 1 });
    expect(s.payout).toBe(400);
    expect(r.gains.get("s")).toBe(400); // 400 → 800: doubled (§8)
  });

  it("a losing shove lands on the felt with exactly 1 chip, debited from the Pot (§9)", () => {
    const games = [finalGame("g1", "home")];
    const tickets = [shove("s", "g1", "away", 400, 15), ticket("b", [["g1", "home", 20]])];
    const players = [
      { id: "s", stackPreAnte: 400, stackAtReveal: 0 },
      { id: "b", stackPreAnte: 500, stackAtReveal: 465 },
    ];
    const r = settleWeek(baseInput({ games, tickets, players, potBalance: 30 - 15 + 420 }));
    const floor = r.entries.find((e) => e.account === "s" && e.kind === "felt_floor");
    expect(floor?.amount).toBe(1);
    const potSide = r.entries.filter((e) => e.account === null && e.kind === "felt_floor");
    expect(potSide[0]?.amount).toBe(-1);
    expect(r.gains.get("s")).toBe(1 - 400);
  });

  it("a voided shove returns chips AND the card, and recharges the ante (§14, acceptance test 25)", () => {
    const games: EngineGame[] = [{ id: "g1", outcome: { kind: "void", reason: "cancelled" } }];
    const tickets = [shove("s", "g1", "away", 400, 15), ticket("b", [["g2", "home", 20]])];
    const gamesAll = [...games, finalGame("g2", "home")];
    const players = [
      { id: "s", stackPreAnte: 400, stackAtReveal: 0 },
      { id: "b", stackPreAnte: 500, stackAtReveal: 465 },
    ];
    const r = settleWeek(baseInput({ games: gamesAll, tickets, players, potBalance: 30 - 15 + 420 }));
    expect(r.returnedShoves).toEqual(["s"]);
    const recharge = r.entries.find((e) => e.account === "s" && e.kind === "ante_recharge");
    expect(recharge?.amount).toBe(-15);
    // net: stake 400 back, ante 15 re-paid → stack 385, gain −15 (the ante, as if no shove)
    expect(r.gains.get("s")).toBe(-15);
  });
});

describe("the Pot (§7)", () => {
  it("240 at 67/33 pays 160 and 79; the last chip rolls", () => {
    const games = [finalGame("g1", "away")];
    const tickets = [ticket("a", [["g1", "away", 10]]), ticket("b", [["g1", "home", 10]])];
    const players = [
      { id: "a", stackPreAnte: 500, stackAtReveal: 480 },
      { id: "b", stackPreAnte: 500, stackAtReveal: 480 },
    ];
    // Pot entering settlement: 240 (per the worked example) + the 20 staked chips.
    const r = settleWeek(baseInput({ games, tickets, players, potBalance: 260, potSplit: [67, 33] }));
    // a wins 10 at 1/1 → gain +0 (10 ante equiv? — here: −10 ante −10 stake +10 return +10 payout)
    expect(r.potAwards).toEqual([
      { playerId: "a", place: 1, amount: 160 },
      { playerId: "b", place: 2, amount: 79 },
    ]);
    // 240 − 239 awarded + swept 0 → 21? Verify the roll: potAfter = 260 + potMoves − awards
    expect(r.potAfter).toBe(260 - 10 - 10 - 239); // returns+payout out, awards out → 1 rolled
  });

  it("ties for a place split that place's share evenly, rounding down (§7)", () => {
    const games = [finalGame("g1", "away")];
    const tickets = [
      ticket("a", [["g1", "away", 10]]),
      ticket("b", [["g1", "away", 10]]),
      ticket("c", [["g1", "home", 10]]),
    ];
    const players = [
      { id: "a", stackPreAnte: 500, stackAtReveal: 480 },
      { id: "b", stackPreAnte: 500, stackAtReveal: 480 },
      { id: "c", stackPreAnte: 500, stackAtReveal: 480 },
    ];
    const r = settleWeek(baseInput({ games, tickets, players, potBalance: 61, potSplit: [100] }));
    // a and b tie for the top gain; 61-pot… pool computed at award time.
    const first = r.potAwards.filter((p) => p.place === 1);
    expect(first).toHaveLength(2);
    expect(first[0].amount).toBe(first[1].amount);
  });

  it("folders are ineligible; a ticket whose games all returned still counts (acceptance test 30)", () => {
    const games: EngineGame[] = [{ id: "g1", outcome: { kind: "void", reason: "cancelled" } }];
    const tickets: EngineTicket[] = [
      ticket("returned", [["g1", "away", 20]]),
      { playerId: "folder", isFold: true, isShove: false, bets: [], committedStake: null, pendingRefund: null },
    ];
    const players = [
      { id: "returned", stackPreAnte: 500, stackAtReveal: 465 },
      { id: "folder", stackPreAnte: 500, stackAtReveal: 485 },
    ];
    const r = settleWeek(baseInput({ games, tickets, players, potBalance: 50 }));
    // Both lost 15 to the ante; the folder "lost less" is impossible — equal gains −15.
    // Only the submitted ticket is eligible, so the Pot goes to "returned".
    expect(r.potAwards.map((p) => p.playerId)).toEqual(["returned"]);
  });

  it("if everyone folded, nothing is awarded and the whole Pot rolls (§7)", () => {
    const tickets: EngineTicket[] = [
      { playerId: "a", isFold: true, isShove: false, bets: [], committedStake: null, pendingRefund: null },
      { playerId: "b", isFold: true, isShove: false, bets: [], committedStake: null, pendingRefund: null },
    ];
    const players = [
      { id: "a", stackPreAnte: 500, stackAtReveal: 485 },
      { id: "b", stackPreAnte: 500, stackAtReveal: 485 },
    ];
    const r = settleWeek(baseInput({ tickets, players, potBalance: 30 }));
    expect(r.potAwards).toHaveLength(0);
    expect(r.potAfter).toBe(30);
  });

  it("a negative Pot is a marker: nobody wins one this week (§7)", () => {
    const games = [finalGame("g1", "away")];
    const tickets = [ticket("a", [["g1", "away", 50]]), ticket("b", [["g1", "home", 10]])];
    const players = [
      { id: "a", stackPreAnte: 500, stackAtReveal: 440 },
      { id: "b", stackPreAnte: 500, stackAtReveal: 480 },
    ];
    // Tiny pot: winner is owed more than the table took in.
    const r = settleWeek(baseInput({ games, tickets, players, potBalance: 60 + 20 - 75 }));
    expect(r.potAwards).toHaveLength(0);
    expect(r.potAfter).toBeLessThan(0);
  });

  it("everyone lost chips: the Pot pays whoever lost the least (§7)", () => {
    const games = [finalGame("g1", "away")];
    const tickets = [ticket("a", [["g1", "home", 10]]), ticket("b", [["g1", "home", 50]])];
    const players = [
      { id: "a", stackPreAnte: 500, stackAtReveal: 475 },
      { id: "b", stackPreAnte: 500, stackAtReveal: 435 },
    ];
    const r = settleWeek(baseInput({ games, tickets, players, potBalance: 90 }));
    expect(r.potAwards[0]?.playerId).toBe("a"); // −25 beats −65
  });
});
