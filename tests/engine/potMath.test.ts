import { describe, expect, it } from "vitest";
import { settleWeek, type EngineGame, type EngineTicket, type SettleWeekInput } from "@/lib/engine";
import { placesPaid, potBreakdown } from "@/lib/stats/potMath";

// potMath re-derives the Pot award for display. The only thing that makes it safe to
// show players is that it agrees with settleWeek — so the central test here does not
// assert hand-written expectations, it runs the real engine and checks the explanation
// against what the engine actually paid.

const game = (id: string, winner: "away" | "home" | "tie"): EngineGame => ({
  id,
  outcome: { kind: "final", winner },
});

const ticket = (
  playerId: string,
  bets: Array<[string, "away" | "home", number]>,
  opts: { isFold?: boolean } = {},
): EngineTicket => ({
  playerId,
  isFold: opts.isFold ?? false,
  isShove: false,
  bets: bets.map(([gameId, side, chips]) => ({ gameId, side, chips })),
  committedStake: null,
  pendingRefund: null,
});

/** Run the engine, then rebuild the explanation from its own output the way the UI does. */
function explain(input: SettleWeekInput) {
  const result = settleWeek(input);
  const potAwardBy = new Map<string, number>();
  for (const a of result.potAwards) potAwardBy.set(a.playerId, (potAwardBy.get(a.playerId) ?? 0) + a.amount);

  const eligible = new Set(input.tickets.filter((t) => !t.isFold).map((t) => t.playerId));
  const breakdown = potBreakdown({
    entries: input.players.map((p) => ({
      playerId: p.id,
      gain: result.gains.get(p.id) ?? 0,
      eligible: eligible.has(p.id),
    })),
    // The pool entering the award: settlement's own movements, before the award itself.
    pool: input.potBalance + result.entries.filter((e) => e.account === null && e.kind !== "pot_award").reduce((s, e) => s + e.amount, 0),
    split: input.potSplit,
  });
  return { result, breakdown, potAwardBy };
}

const base = (over: Partial<SettleWeekInput>): SettleWeekInput => ({
  weekNumber: 3,
  tickets: [],
  games: [],
  players: [],
  potBalance: 0,
  potSplit: [100],
  ...over,
});

describe("potBreakdown agrees with the engine", () => {
  it("names the same winners, places and amounts settleWeek paid", () => {
    const input = base({
      games: [game("g1", "away"), game("g2", "home")],
      tickets: [
        ticket("alice", [["g1", "away", 50], ["g2", "home", 50]]), // both right
        ticket("bob", [["g1", "away", 50], ["g2", "away", 50]]), // one right
        ticket("cara", [["g1", "home", 50], ["g2", "away", 50]]), // both wrong
      ],
      players: [
        { id: "alice", stackPreAnte: 500, stackAtReveal: 390 },
        { id: "bob", stackPreAnte: 500, stackAtReveal: 390 },
        { id: "cara", stackPreAnte: 500, stackAtReveal: 390 },
      ],
      potBalance: 300,
      potSplit: [67, 33],
    });

    const { result, breakdown, potAwardBy } = explain(input);

    // Every player the engine paid appears with the same place and amount.
    for (const a of result.potAwards) {
      const row = breakdown.standings.find((s) => s.playerId === a.playerId)!;
      expect(row.place).toBe(a.place);
      expect(row.award).toBe(a.amount);
    }
    // And nobody the engine did not pay is shown as paid.
    for (const s of breakdown.standings) {
      expect(s.award).toBe(potAwardBy.get(s.playerId) ?? 0);
    }
    expect(breakdown.awarded).toBe(result.potAwards.reduce((n, a) => n + a.amount, 0));
  });

  it("shows the ordering rule the Pot actually uses: gain, ante included", () => {
    const { breakdown } = explain(
      base({
        games: [game("g1", "away")],
        tickets: [ticket("hi", [["g1", "away", 50]]), ticket("lo", [["g1", "home", 50]])],
        players: [
          { id: "hi", stackPreAnte: 500, stackAtReveal: 440 },
          { id: "lo", stackPreAnte: 500, stackAtReveal: 440 },
        ],
        potBalance: 100,
        potSplit: [100],
      }),
    );
    const [first, second] = breakdown.standings;
    expect(first.playerId).toBe("hi");
    expect(first.gain).toBeGreaterThan(second.gain);
    expect(first.place).toBe(1);
  });

  it("splits one place between tied gains rather than inventing an order", () => {
    const { result, breakdown } = explain(
      base({
        games: [game("g1", "away")],
        tickets: [
          ticket("twinA", [["g1", "away", 50]]),
          ticket("twinB", [["g1", "away", 50]]),
          ticket("loser", [["g1", "home", 50]]),
        ],
        players: [
          { id: "twinA", stackPreAnte: 500, stackAtReveal: 440 },
          { id: "twinB", stackPreAnte: 500, stackAtReveal: 440 },
          { id: "loser", stackPreAnte: 500, stackAtReveal: 440 },
        ],
        potBalance: 201,
        potSplit: [100],
      }),
    );
    const a = breakdown.standings.find((s) => s.playerId === "twinA")!;
    const b = breakdown.standings.find((s) => s.playerId === "twinB")!;
    expect(a.place).toBe(1);
    expect(b.place).toBe(1);
    expect(a.sharedBy).toBe(2);
    expect(a.award).toBe(b.award);
    expect(a.award + b.award).toBe(result.potAwards.reduce((n, x) => n + x.amount, 0));
    // The odd chip cannot be split, so it rolls (§7) rather than going to one of them.
    expect(breakdown.rolled).toBe(1);
  });

  it("excludes folders from the ranking — they anted but did not play (§7)", () => {
    const { breakdown } = explain(
      base({
        games: [game("g1", "away")],
        tickets: [ticket("player", [["g1", "away", 50]]), ticket("folder", [], { isFold: true })],
        players: [
          { id: "player", stackPreAnte: 500, stackAtReveal: 440 },
          { id: "folder", stackPreAnte: 500, stackAtReveal: 490 },
        ],
        potBalance: 100,
        potSplit: [100],
      }),
    );
    const folder = breakdown.standings.find((s) => s.playerId === "folder")!;
    expect(folder.eligible).toBe(false);
    expect(folder.place).toBeNull();
    expect(folder.award).toBe(0);
    // The folder is still shown — the room can see the fold cost them the ante.
    expect(folder.gain).toBeLessThan(0);
  });

  it("awards nothing and rolls the whole balance when the Pot is under water (the marker)", () => {
    const b = potBreakdown({
      entries: [
        { playerId: "a", gain: 120, eligible: true },
        { playerId: "b", gain: 40, eligible: true },
      ],
      pool: -800,
      split: [100],
    });
    expect(b.noAward).toBe(true);
    expect(b.awarded).toBe(0);
    expect(b.standings.every((s) => s.award === 0)).toBe(true);
    // Places are still ranked, so the week still reads as a week — nobody is paid.
    expect(b.standings[0].place).toBe(1);
    expect(placesPaid(b)).toBe(0);
  });

  it("reproduces the real Week 1 split the torture season settled: 953 → 476/314/162", () => {
    const b = potBreakdown({
      entries: [
        { playerId: "gus", gain: 182, eligible: true },
        { playerId: "sam", gain: 89, eligible: true },
        { playerId: "walt", gain: 67, eligible: true },
        { playerId: "other", gain: 55, eligible: true },
      ],
      pool: 953,
      split: [50, 33, 17],
    });
    expect(b.standings.map((s) => s.award)).toEqual([476, 314, 162, 0]);
    expect(b.awarded).toBe(952);
    expect(b.rolled).toBe(1); // the chip that could not be split — matches pot=1
    expect(placesPaid(b)).toBe(3);
  });
});
