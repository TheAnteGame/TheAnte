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
  antesCollected: 0,
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

describe("no fold penalty (§3 v1.5, D-110)", () => {
  const fold = (id: string): EngineTicket => ({ playerId: id, isFold: true, isShove: false, bets: [], committedStake: null, pendingRefund: null });

  // The penalty (D-096) was withdrawn mid-season. Week 3 is the one week it ever
  // posted, so a re-settlement of Week 3 is exactly the case that must now drop it.
  it.each([1, 2, 3, 4, 18])("a fold in Week %i moves no chips at settlement", (weekNumber) => {
    const r = settleWeek(baseInput({ weekNumber, tickets: [fold("a")], players: [{ id: "a", stackPreAnte: 500, stackAtReveal: 490 }], potBalance: 10 }));
    expect(r.entries.filter((e) => e.account === "a")).toEqual([]);
    expect(r.entries.some((e) => e.kind === "fold_penalty")).toBe(false);
    expect(r.potAfter).toBe(10);
  });
});

describe("unanimous sides and the Pot minimum (§5, §7 v1.6, D-127)", () => {
  // Week 8's real shape: a shove wins on a side nobody opposed, and the Pot is far
  // smaller than the shove. 297 staked; the Pot holds 195 of antes plus the stake.
  const shove = (id: string, chips: number): EngineTicket => ({
    playerId: id,
    isFold: false,
    isShove: true,
    bets: [{ gameId: "g1", side: "away", chips }],
    committedStake: chips,
    pendingRefund: 15,
  });
  const players = [
    { id: "s", stackPreAnte: 297, stackAtReveal: 0 },
    { id: "b", stackPreAnte: 500, stackAtReveal: 465 },
  ];
  const tickets = [shove("s", 297), ticket("b", [["g2", "home", 20]])];
  const games = [finalGame("g1", "away"), finalGame("g2", "away")];
  const input = (weekNumber: number) =>
    baseInput({ weekNumber, tickets, games, players, potBalance: 195 + 297 + 20, antesCollected: 195 });

  it("before Week 8 a Pot under water pays nothing and the marker carries", () => {
    const r = settleWeek(input(7));
    // Pot: 512 in, 594 back to the shover → −82. Nobody wins one.
    expect(r.pool).toBe(-82);
    expect(r.potAwards).toEqual([]);
    expect(r.potAfter).toBe(-82);
  });

  it("from Week 8 it still pays half the antes, and the shortfall joins the marker", () => {
    const r = settleWeek(input(8));
    expect(r.pool).toBe(97); // floor(195 / 2)
    expect(r.potAwards).toEqual([{ playerId: "s", place: 1, amount: 97 }]);
    expect(r.potAfter).toBe(-82 - 97);
    // Conserved: every chip the award paid out is the Pot's debt, nothing minted.
    expect(r.entries.reduce((s, e) => s + e.amount, 0)).toBe(0);
  });

  it("a Pot already above its minimum pays its balance, exactly as before", () => {
    const r = settleWeek(baseInput({ weekNumber: 12, tickets, games, players, potBalance: 1000, antesCollected: 195 }));
    expect(r.pool).toBe(1000 - 594);
    expect(r.potAwards[0].amount).toBe(406);
  });

  it("nobody with a live ticket means no award, minimum or not", () => {
    const fold = (id: string): EngineTicket => ({ playerId: id, isFold: true, isShove: false, bets: [], committedStake: null, pendingRefund: null });
    const r = settleWeek(baseInput({ weekNumber: 10, tickets: [fold("b")], players: [players[1]], potBalance: -50, antesCollected: 280 }));
    expect(r.potAwards).toEqual([]);
    expect(r.potAfter).toBe(-50);
  });

  it("a shove still pays even money on a unanimous side after Week 9 (§8)", () => {
    const r = settleWeek({ ...input(9), potBalance: 10_000 });
    expect(r.bets.find((b) => b.playerId === "s")).toMatchObject({ result: "won", payout: 297, multiplier: { num: 1, den: 1 } });
  });

  it("a unanimous side paid even money in Week 8 and pays the floor from Week 9", () => {
    const pair = [ticket("a", [["g1", "away", 30]]), ticket("c", [["g1", "away", 20]])];
    const ps = [
      { id: "a", stackPreAnte: 500, stackAtReveal: 455 },
      { id: "c", stackPreAnte: 500, stackAtReveal: 465 },
    ];
    const at = (weekNumber: number) =>
      settleWeek(baseInput({ weekNumber, tickets: pair, games: [finalGame("g1", "away")], players: ps, potBalance: 1000 })).bets;
    expect(at(8).map((b) => b.payout)).toEqual([30, 20]);
    expect(at(9).map((b) => b.payout)).toEqual([7, 5]); // 30 × 0.25 → 7, 20 × 0.25 → 5
  });
});

describe("the shover sits out the Pot from Week 9 (§7 v1.7, D-128)", () => {
  const shove: EngineTicket = {
    playerId: "s",
    isFold: false,
    isShove: true,
    bets: [{ gameId: "g1", side: "away", chips: 300 }],
    committedStake: 300,
    pendingRefund: 15,
  };
  const players = [
    { id: "s", stackPreAnte: 300, stackAtReveal: 0 },
    { id: "b", stackPreAnte: 500, stackAtReveal: 455 },
    { id: "c", stackPreAnte: 500, stackAtReveal: 465 },
  ];
  const tickets = [shove, ticket("b", [["g2", "home", 30]]), ticket("c", [["g2", "away", 20]])];
  const games = [finalGame("g1", "away"), finalGame("g2", "home")];
  const at = (weekNumber: number) =>
    settleWeek(baseInput({ weekNumber, tickets, games, players, potBalance: 2000, antesCollected: 30 }));

  it("in Week 8 the winning shover's doubled stack takes the Pot", () => {
    expect(at(8).potAwards.map((a) => a.playerId)).toEqual(["s"]);
  });

  it("from Week 9 the Pot goes to the best week among everyone else", () => {
    const r = at(9);
    expect(r.potAwards.map((a) => a.playerId)).toEqual(["b"]);
    // The shove itself is untouched: still doubled, at even money.
    expect(r.bets.find((b) => b.playerId === "s")).toMatchObject({ result: "won", payout: 300 });
    expect(r.entries.reduce((s, e) => s + e.amount, 0)).toBe(0);
  });

  it("a week where only the shover played awards nothing and the Pot rolls", () => {
    const r = settleWeek(baseInput({ weekNumber: 9, tickets: [shove], games, players: [players[0]], potBalance: 500, antesCollected: 0 }));
    expect(r.potAwards).toEqual([]);
    expect(r.potAfter).toBe(500 - 600);
  });
});

describe("from Week 9 the Pot is the week's antes plus what the table kept (§7 v1.8, D-130)", () => {
  // Two players, 15 ante each, entering with the Pot's account 365 under.
  const players = [
    { id: "a", stackPreAnte: 500, stackAtReveal: 475 },
    { id: "b", stackPreAnte: 500, stackAtReveal: 435 },
  ];
  const tickets = [ticket("a", [["g1", "away", 10]]), ticket("b", [["g1", "home", 50]])];
  const at = (weekNumber: number, winner: "away" | "home") =>
    settleWeek(
      baseInput({ weekNumber, tickets, games: [finalGame("g1", winner)], players, potBalance: -365 + 30 + 60, antesCollected: 30 }),
    );

  it("the table kept 40: the Pot pays 30 + 40, and the debt is not paid down", () => {
    const r = at(9, "away"); // a wins 10 at 1x; b's 50 is lost → the table keeps 40
    expect(r.swept).toBe(40);
    expect(r.pool).toBe(70);
    expect(r.potAwards).toEqual([{ playerId: "a", place: 1, amount: 70 }]);
    expect(r.potAfter).toBe(-365);
  });

  it("the table came up short by 40: the Pot still pays its 30 antes, and the debt grows", () => {
    const r = at(9, "home"); // b wins 50 at 1x; a's 10 is lost → the table is 40 short
    expect(r.swept).toBe(-40);
    expect(r.pool).toBe(30);
    expect(r.potAfter).toBe(-365 - 40);
    expect(r.entries.reduce((s, e) => s + e.amount, 0)).toBe(0);
  });

  it("a balance bigger than antes plus sweep (a roll) is still paid out whole", () => {
    const r = settleWeek(
      baseInput({ weekNumber: 10, tickets, games: [finalGame("g1", "away")], players, potBalance: 500 + 30 + 60, antesCollected: 30 }),
    );
    expect(r.pool).toBe(500 + 30 + 40);
    expect(r.potAfter).toBe(0);
  });

  it("Week 8 keeps its half-the-antes minimum", () => {
    expect(at(8, "home").pool).toBe(15);
  });
});
