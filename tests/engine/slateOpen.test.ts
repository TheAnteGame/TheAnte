import { describe, expect, it } from "vitest";
import { computeSlateOpen } from "@/lib/engine";
import type { EnginePlayer } from "@/lib/engine";

const player = (id: string, stackPreAnte: number, status: "approved" | "deactivated" = "approved"): EnginePlayer => ({
  id,
  status,
  stackPreAnte,
  shoveUsedWeek: null,
});

describe("slate open (§14 steps 1–2)", () => {
  it("felt status: a 25-chip stack is felt in Week 15 and NOT in Week 10 (acceptance test 33)", () => {
    const players = [player("a", 25), player("b", 500), player("c", 500), player("d", 500)];
    expect(computeSlateOpen(players, 10).feltPlayerIds.has("a")).toBe(false); // ante 20
    expect(computeSlateOpen(players, 15).feltPlayerIds.has("a")).toBe(true); // ante 30
  });

  it("felt players pay no ante and their limit is their whole stack (§9)", () => {
    const players = [player("felt", 12), player("b", 500), player("c", 480)];
    const r = computeSlateOpen(players, 15);
    expect(r.feltPlayerIds.has("felt")).toBe(true);
    expect(r.entries.filter((e) => e.account === "felt")).toHaveLength(0);
    expect(r.houseLimits.get("felt")).toBe(12);
  });

  it("the median excludes felt and deactivated players, pre-ante (§14)", () => {
    const players = [
      player("felt", 5),
      player("quit", 900, "deactivated"),
      player("a", 400),
      player("b", 480),
      player("c", 490),
      player("d", 600),
    ];
    const r = computeSlateOpen(players, 1);
    expect(r.medianSnapshot).toBe(480); // median of 400,480,490,600 = 485 → 480
  });

  it("deactivated players are excluded from the count; felt players are counted (§7)", () => {
    const players = [
      player("felt", 5),
      player("quit", 900, "deactivated"),
      ...Array.from({ length: 15 }, (_, i) => player(`p${i}`, 500)),
    ];
    const r = computeSlateOpen(players, 1);
    expect(r.activeCountSnapshot).toBe(16); // 15 + felt; deactivated out
    expect(r.placesTierSnapshot).toBe(2); // 16–23 pays two places
  });

  it("antes are two-sided: every player debit has a Pot credit", () => {
    const players = [player("a", 500), player("b", 500)];
    const r = computeSlateOpen(players, 5);
    const playerSide = r.entries.filter((e) => e.account !== null).reduce((s, e) => s + e.amount, 0);
    const potSide = r.entries.filter((e) => e.account === null).reduce((s, e) => s + e.amount, 0);
    expect(playerSide).toBe(-30);
    expect(potSide).toBe(30);
  });

  it("a stack exactly equal to the ante pays it, floors to 1 from the Pot, and lands on the felt (§9)", () => {
    const players = [player("edge", 30), player("b", 500), player("c", 500)];
    const r = computeSlateOpen(players, 15); // ante 30
    const edgeEntries = r.entries.filter((e) => e.account === "edge");
    expect(edgeEntries.find((e) => e.kind === "ante")?.amount).toBe(-30);
    expect(edgeEntries.find((e) => e.kind === "felt_floor")?.amount).toBe(1);
    const potFloor = r.entries.find((e) => e.account === null && e.kind === "felt_floor");
    expect(potFloor?.amount).toBe(-1); // even mercy is paid for by somebody (§9)
    expect(r.feltPlayerIds.has("edge")).toBe(true);
    expect(r.houseLimits.get("edge")).toBe(1);
    // and they were counted in the median before any of that happened
    expect(r.medianSnapshot).toBe(500); // sorted [30, 500, 500] → middle value 500
  });

  it("post-ante limits use the pre-ante median (§4 'which stack, measured when')", () => {
    // Median measured pre-ante at 500; a 500 stack pays 30 → limit from min(470, 500)/3
    const players = [player("a", 500), player("b", 500), player("c", 500)];
    const r = computeSlateOpen(players, 15);
    expect(r.medianSnapshot).toBe(500);
    expect(r.houseLimits.get("a")).toBe(150); // floor10(470/3 = 156.6) = 150
  });
});
