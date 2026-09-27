import { describe, expect, it } from "vitest";
import { marginOf, orderBoard, stateOf, type BoardGame } from "./gameState";

const g = (
  id: string,
  status: string,
  kickoffAt: string,
  awayScore: number | null = null,
  homeScore: number | null = null,
  voidReason: string | null = null,
): BoardGame & { id: string } => ({ id, status, kickoffAt, awayScore, homeScore, voidReason });

describe("stateOf", () => {
  it("reads the four states off status and the void reason", () => {
    expect(stateOf({ status: "scheduled", voidReason: null })).toBe("upcoming");
    expect(stateOf({ status: "in_progress", voidReason: null })).toBe("live");
    expect(stateOf({ status: "final", voidReason: null })).toBe("final");
    expect(stateOf({ status: "cancelled", voidReason: null })).toBe("void");
    expect(stateOf({ status: "postponed", voidReason: null })).toBe("void");
  });

  it("treats a game voided before the deadline as void however its status reads", () => {
    expect(stateOf({ status: "final", voidReason: "kicked_pre_deadline" })).toBe("void");
  });
});

describe("marginOf", () => {
  it("is the points between the sides, either way round", () => {
    expect(marginOf({ awayScore: 17, homeScore: 24 })).toBe(7);
    expect(marginOf({ awayScore: 24, homeScore: 17 })).toBe(7);
    expect(marginOf({ awayScore: 21, homeScore: 21 })).toBe(0);
  });
  it("is null with nothing to compare", () => {
    expect(marginOf({ awayScore: null, homeScore: 10 })).toBeNull();
  });
});

describe("orderBoard", () => {
  it("puts what is happening now first and what is over last", () => {
    const out = orderBoard([
      g("done", "final", "2026-09-27T17:00:00Z", 30, 3),
      g("soon", "scheduled", "2026-09-27T20:00:00Z"),
      g("now", "in_progress", "2026-09-27T17:00:00Z", 14, 10),
    ]);
    expect(out.map((x) => x.id)).toEqual(["now", "soon", "done"]);
  });

  it("sorts live games by how close they are, not by kickoff", () => {
    const out = orderBoard([
      g("blowout", "in_progress", "2026-09-27T17:00:00Z", 35, 7),
      g("nailbiter", "in_progress", "2026-09-27T20:00:00Z", 21, 20),
      g("close", "in_progress", "2026-09-27T18:00:00Z", 14, 10),
    ]);
    expect(out.map((x) => x.id)).toEqual(["nailbiter", "close", "blowout"]);
  });

  it("does not let a close finished game jump a kickoff that has not happened", () => {
    const out = orderBoard([
      g("tightfinish", "final", "2026-09-27T17:00:00Z", 20, 21),
      g("later", "scheduled", "2026-09-27T20:00:00Z"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["later", "tightfinish"]);
  });

  it("keeps upcoming and finished blocks chronological", () => {
    const out = orderBoard([
      g("late", "scheduled", "2026-09-27T20:00:00Z"),
      g("early", "scheduled", "2026-09-27T17:00:00Z"),
      g("finishedLate", "final", "2026-09-26T20:00:00Z", 10, 30),
      g("finishedEarly", "final", "2026-09-26T17:00:00Z", 3, 40),
    ]);
    expect(out.map((x) => x.id)).toEqual(["early", "late", "finishedEarly", "finishedLate"]);
  });

  it("puts a live game with no score yet behind live games that have one", () => {
    const out = orderBoard([
      g("kickoff", "in_progress", "2026-09-27T17:00:00Z"),
      g("scored", "in_progress", "2026-09-27T20:00:00Z", 7, 3),
    ]);
    expect(out.map((x) => x.id)).toEqual(["scored", "kickoff"]);
  });

  it("drops void games to the very bottom and leaves the input alone", () => {
    const input = [g("void", "cancelled", "2026-09-26T17:00:00Z"), g("done", "final", "2026-09-27T17:00:00Z", 1, 2)];
    const out = orderBoard(input);
    expect(out.map((x) => x.id)).toEqual(["done", "void"]);
    expect(input.map((x) => x.id)).toEqual(["void", "done"]);
  });
});
