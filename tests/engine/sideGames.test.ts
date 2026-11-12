import { describe, expect, it } from "vitest";
import {
  assertInvariants,
  computeBalances,
  InvariantViolation,
  isSideGameKind,
  planSideGame,
  planSideGameWeek,
  sideRowToEngine,
  SideGameError,
  type EngineLedgerEntry,
  type SideGameInput,
  type SideGamePlan,
} from "@/lib/engine";

// D-131 rules, D-132 money. Every case also proves conservation: the rows sum to
// zero, the Pot never moves, and a ledger that runs them still passes assertInvariants.

const players = Array.from({ length: 10 }, (_, i) => `p${i}`);

/** A ledger of buy-ins plus a Pot float, so the assertion has something real to eat. */
function baseLedger(stacks: Record<string, number> = {}): EngineLedgerEntry[] {
  const rows: EngineLedgerEntry[] = [];
  for (const p of players) {
    rows.push({ account: p, kind: "buy_in", amount: 500, reason: "Buy-in" });
    const s = stacks[p];
    if (s !== undefined && s !== 500) {
      // Move the difference to/from the Pot, as a week of antes and bets would.
      rows.push({ account: p, kind: "ante", amount: s - 500, reason: "fixture" });
      rows.push({ account: null, kind: "ante", amount: 500 - s, reason: "fixture" });
    }
  }
  return rows;
}

function stacksOf(ledger: EngineLedgerEntry[]): Map<string, number> {
  return computeBalances(ledger).stacks;
}

function input(over: Partial<SideGameInput> & Pick<SideGameInput, "entrants" | "order">, ledger = baseLedger()): SideGameInput {
  return { game: "bingo", week: 10, soloWon: null, poolBefore: 0, stacks: stacksOf(ledger), ...over };
}

/** Run a plan on a ledger and prove the books. Returns the new ledger. */
function apply(ledger: EngineLedgerEntry[], plan: SideGamePlan): EngineLedgerEntry[] {
  expect(plan.rows.reduce((s, r) => s + r.amount, 0)).toBe(0);
  for (const r of plan.rows) {
    expect((r.playerId === null) !== (r.account === null)).toBe(true); // exactly one owner
    expect(isSideGameKind(r.kind)).toBe(true);
    expect(r.idempotencyKey.startsWith(`play:${plan.game}:${plan.week}:`)).toBe(true);
  }
  // The unique index is (week_id, idempotency_key, player_id) nulls not distinct.
  const keys = plan.rows.map((r) => `${r.idempotencyKey}|${r.playerId ?? "∅"}`);
  expect(new Set(keys).size).toBe(keys.length);

  const before = computeBalances(ledger);
  const next = [...ledger, ...plan.rows.map(sideRowToEngine)];
  const after = assertInvariants(next);
  expect(after.pot).toBe(before.pot); // a side game never touches the Pot
  const pool = plan.game === "bingo" ? "play_pool_bingo" : "play_pool_crunch";
  expect(after.sides[pool]).toBe(plan.poolAfter);
  expect(after.sides.play_house - before.sides.play_house).toBe(plan.houseDelta);
  return next;
}

describe("side games — contested (rules 4–5)", () => {
  it("the winner takes every entry: 7 entrants, 70 chips, a 60-chip gain", () => {
    const ledger = baseLedger();
    const entrants = players.slice(0, 7);
    const plan = planSideGame(input({ entrants, order: [["p3"], ["p0", "p1"], ["p2", "p4", "p5", "p6"]] }, ledger));
    expect(plan.mode).toBe("contested");
    expect(plan.winners).toEqual(["p3"]);
    expect(plan.prize).toBe(70);
    expect(plan.payoutEach).toBe(70);
    expect(plan.poolAfter).toBe(0);
    const next = apply(ledger, plan);
    const s = computeBalances(next).stacks;
    expect(s.get("p3")).toBe(560);
    expect(s.get("p0")).toBe(490);
    expect(s.get("p9")).toBe(500); // didn't enter
  });

  it("a 3-way tie splits in whole chips and the remainder rolls into the pool", () => {
    const ledger = baseLedger();
    const plan = planSideGame(input({ entrants: players.slice(0, 5), order: [["p0", "p1", "p2"], ["p3"], ["p4"]] }, ledger));
    expect(plan.winners).toEqual(["p0", "p1", "p2"]);
    expect(plan.prize).toBe(50);
    expect(plan.payoutEach).toBe(16);
    expect(plan.poolAfter).toBe(2);
    const next = apply(ledger, plan);
    expect(computeBalances(next).stacks.get("p0")).toBe(506);
  });

  it("the rollover is paid to the next contested week's winner", () => {
    let ledger = baseLedger();
    const tie = planSideGame(input({ entrants: players.slice(0, 5), order: [["p0", "p1", "p2"], ["p3", "p4"]] }, ledger));
    ledger = apply(ledger, tie);
    expect(tie.poolAfter).toBe(2);

    const next = planSideGame(input({ week: 11, entrants: ["p5", "p6", "p7", "p8"], order: [["p8"], ["p5"], ["p6", "p7"]], poolBefore: 2 }, ledger));
    expect(next.prize).toBe(42);
    expect(next.payoutEach).toBe(42);
    expect(next.poolAfter).toBe(0);
    ledger = apply(ledger, next);
    expect(computeBalances(ledger).stacks.get("p8")).toBe(532);
    expect(computeBalances(ledger).sides.play_pool_bingo).toBe(0);
  });
});

describe("side games — one entrant plays the house (rule 6)", () => {
  it("a solo win pays 20: 10 back from the pool, 10 from the house", () => {
    const ledger = baseLedger();
    const plan = planSideGame(input({ game: "crunch", entrants: ["p0"], order: [["p0"]], soloWon: true }, ledger));
    expect(plan.mode).toBe("solo_win");
    expect(plan.payoutEach).toBe(20);
    expect(plan.houseDelta).toBe(-10);
    const next = apply(ledger, plan);
    const b = computeBalances(next);
    expect(b.stacks.get("p0")).toBe(510);
    expect(b.sides.play_house).toBe(-10); // the house may go negative
    expect(b.sides.play_pool_crunch).toBe(0);
  });

  it("a solo loss moves the 10 from the pool to the house", () => {
    const ledger = baseLedger();
    const plan = planSideGame(input({ game: "crunch", entrants: ["p0"], order: [["p0"]], soloWon: false }, ledger));
    expect(plan.mode).toBe("solo_loss");
    const next = apply(ledger, plan);
    const b = computeBalances(next);
    expect(b.stacks.get("p0")).toBe(490);
    expect(b.sides.play_house).toBe(10);
  });

  it("never touches the rollover in a solo week, win or lose", () => {
    for (const soloWon of [true, false]) {
      const ledger = baseLedger();
      const plan = planSideGame(input({ entrants: ["p0"], order: [["p0"]], soloWon, poolBefore: 7 }, ledger));
      expect(plan.poolAfter).toBe(7);
      expect(plan.payoutEach).toBe(soloWon ? 20 : 0);
    }
  });

  it("refuses a lone entrant with no solo result rather than guessing", () => {
    expect(() => planSideGame(input({ entrants: ["p0"], order: [["p0"]], soloWon: null }))).toThrow(SideGameError);
  });
});

describe("side games — can't cover it (rule 9)", () => {
  it("drops a winner who can't cover the 10; the order closes up behind them", () => {
    const ledger = baseLedger({ p0: 4 });
    const plan = planSideGame(input({ entrants: ["p0", "p1", "p2", "p3"], order: [["p0"], ["p2"], ["p1", "p3"]] }, ledger));
    expect(plan.dropped).toEqual(["p0"]);
    expect(plan.eligible).toEqual(["p1", "p2", "p3"]);
    expect(plan.winners).toEqual(["p2"]);
    expect(plan.prize).toBe(30);
    expect(plan.rows.some((r) => r.playerId === "p0")).toBe(false); // nothing taken
    const next = apply(ledger, plan);
    expect(computeBalances(next).stacks.get("p0")).toBe(4);
    expect(computeBalances(next).stacks.get("p2")).toBe(520);
  });

  it("needs 11 to enter: the §9 floor means a losing entry must leave at least 1", () => {
    const ledger = baseLedger({ p0: 10, p1: 11 });
    const plan = planSideGame(input({ entrants: ["p0", "p1", "p2"], order: [["p2"], ["p1"], ["p0"]] }, ledger));
    expect(plan.dropped).toEqual(["p0"]);
    const next = apply(ledger, plan);
    expect(computeBalances(next).stacks.get("p1")).toBe(1);
  });

  it("a seat with no chips (removed) is dropped, never charged", () => {
    const plan = planSideGame(input({ entrants: ["gone", "p1", "p2"], order: [["gone"], ["p1", "p2"]] }));
    expect(plan.dropped).toEqual(["gone"]);
    expect(plan.winners).toEqual(["p1", "p2"]);
    expect(plan.payoutEach).toBe(10);
  });

  it("two entered, one dropped: no contest — nothing taken, the rollover waits", () => {
    const ledger = baseLedger({ p0: 3 });
    const plan = planSideGame(input({ entrants: ["p0", "p1"], order: [["p0"], ["p1"]], poolBefore: 5 }, ledger));
    expect(plan.mode).toBe("no_contest");
    expect(plan.rows).toEqual([]);
    expect(plan.poolAfter).toBe(5);
  });

  it("no entrants: nothing happens (rule 7)", () => {
    const plan = planSideGame(input({ entrants: [], order: [], poolBefore: 3 }));
    expect(plan.mode).toBe("none");
    expect(plan.rows).toEqual([]);
    expect(plan.poolAfter).toBe(3);
  });
});

describe("side games — season end (rule 8)", () => {
  it("week 18 sweeps what is left in the pool to the house after the game", () => {
    const ledger = baseLedger();
    // Seed a rollover of 2 the honest way: a week-17 three-way tie.
    const w17 = planSideGame(input({ week: 17, entrants: players.slice(0, 5), order: [["p0", "p1", "p2"]] }, ledger));
    const l17 = apply(ledger, w17);
    const w18 = planSideGame(input({ week: 18, entrants: ["p5", "p6", "p7"], order: [["p5", "p6"], ["p7"]], poolBefore: 2 }, l17));
    // 30 + 2 = 32, split two ways is 16 each, nothing left; no sweep row.
    expect(w18.payoutEach).toBe(16);
    expect(w18.swept).toBe(0);
    apply(l17, w18);

    const odd = planSideGame(input({ week: 18, entrants: ["p5", "p6", "p7"], order: [["p5", "p6", "p7"]], poolBefore: 2 }, l17));
    // 32 three ways: 10 each, 2 left — swept to the house.
    expect(odd.payoutEach).toBe(10);
    expect(odd.swept).toBe(2);
    expect(odd.poolAfter).toBe(0);
    expect(odd.houseDelta).toBe(2);
    apply(l17, odd);
  });

  it("week 18 with nobody in still sweeps the pool, and a solo week 18 sweeps after the house", () => {
    const none = planSideGame(input({ week: 18, entrants: [], order: [], poolBefore: 4 }));
    expect(none.swept).toBe(4);
    expect(none.rows.reduce((s, r) => s + r.amount, 0)).toBe(0);
    const solo = planSideGame(input({ week: 18, entrants: ["p0"], order: [["p0"]], soloWon: false, poolBefore: 4 }));
    expect(solo.houseDelta).toBe(14);
    expect(solo.poolAfter).toBe(0);
  });
});

describe("side games — a whole week", () => {
  it("both games in order, each seeing the stacks the last one left (no spending the same 10 twice)", () => {
    const ledger = baseLedger({ p0: 15 });
    const plans = planSideGameWeek({
      week: 10,
      games: [
        { game: "crunch", entrants: ["p0", "p1"], order: [["p1"], ["p0"]], soloWon: null },
        { game: "bingo", entrants: ["p0", "p2"], order: [["p2"], ["p0"]], soloWon: null },
      ],
      pools: {},
      stacks: stacksOf(ledger),
    });
    expect(plans.map((p) => p.game)).toEqual(["bingo", "crunch"]);
    // Bingo first: p0 15 → 5. Crunch: p0 can't cover it, so it's one left — no contest.
    expect(plans[0].eligible).toEqual(["p0", "p2"]);
    expect(plans[1].dropped).toEqual(["p0"]);
    expect(plans[1].mode).toBe("no_contest");
    let l = ledger;
    for (const p of plans) l = apply(l, p);
  });

  it("skips a game already on the ledger, and refuses a game listed twice", () => {
    const plans = planSideGameWeek({
      week: 10,
      games: [{ game: "bingo", entrants: ["p0", "p1"], order: [["p0"]], soloWon: null }],
      pools: {},
      stacks: stacksOf(baseLedger()),
      skip: new Set(["bingo"]),
    });
    expect(plans.map((p) => p.game)).toEqual(["crunch"]);
    expect(() =>
      planSideGameWeek({
        week: 10,
        games: [
          { game: "bingo", entrants: [], order: [], soloWon: null },
          { game: "bingo", entrants: [], order: [], soloWon: null },
        ],
        pools: {},
        stacks: new Map(),
      }),
    ).toThrow(SideGameError);
  });

  it("refuses malformed results: a stranger in the order, a duplicate, nobody ranked", () => {
    expect(() => planSideGame(input({ entrants: ["p0", "p1"], order: [["p9"]] }))).toThrow(SideGameError);
    expect(() => planSideGame(input({ entrants: ["p0", "p1"], order: [["p0"], ["p0"]] }))).toThrow(SideGameError);
    expect(() => planSideGame(input({ entrants: ["p0", "p0"], order: [] }))).toThrow(SideGameError);
    expect(() => planSideGame(input({ entrants: ["p0", "p1"], order: [] }))).toThrow(SideGameError);
    expect(() => planSideGame(input({ week: 19, entrants: [], order: [] }))).toThrow(SideGameError);
  });
});

describe("conservation with side accounts (D-132)", () => {
  it("side accounts are counted, never as Pot", () => {
    const ledger = baseLedger();
    const plan = planSideGame(input({ entrants: ["p0"], order: [["p0"]], soloWon: true }, ledger));
    const b = assertInvariants([...ledger, ...plan.rows.map(sideRowToEngine)]);
    expect(b.pot).toBe(0);
    expect(b.sides.play_house).toBe(-10);
  });

  it("a pool below zero is a violation; a negative house is not", () => {
    const ledger = baseLedger();
    expect(() =>
      assertInvariants([
        ...ledger,
        { account: null, side: "play_pool_bingo", kind: "play_payout", amount: -5, reason: "x" },
        { account: "p0", kind: "play_payout", amount: 5, reason: "x" },
      ]),
    ).toThrow(InvariantViolation);
    expect(() =>
      assertInvariants([
        ...ledger,
        { account: null, side: "play_house", kind: "play_house", amount: -5, reason: "x" },
        { account: "p0", kind: "play_payout", amount: 5, reason: "x" },
      ]),
    ).not.toThrow();
  });

  it("a row with both a player and a side account is refused", () => {
    expect(() =>
      computeBalances([{ account: "p0", side: "play_house", kind: "play_house", amount: 1, reason: "x" }]),
    ).toThrow(InvariantViolation);
  });

  it("a side chip leaking into the Pot breaks conservation's split even when the total balances", () => {
    // Book a pool row as owner-less (no side): the total still balances — exactly the
    // D-023 shape — but the Pot reads 20 it does not own.
    const ledger = baseLedger();
    const b = computeBalances([
      ...ledger,
      { account: "p0", kind: "play_entry", amount: -10, reason: "x" },
      { account: "p1", kind: "play_entry", amount: -10, reason: "x" },
      { account: null, kind: "play_entry", amount: 20, reason: "leak" },
    ]);
    expect(b.pot).toBe(20);
    expect(b.sides.play_pool_bingo).toBe(0);
  });
});
