import { describe, expect, it } from "vitest";
import { leaderFrom, type StandingRow } from "@/lib/ticker/leader";

const row = (first: string, stack: number | null, status = "approved"): StandingRow => ({
  first_name: first,
  last_name: `${first}son`,
  stack,
  status,
});

describe("leaderFrom", () => {
  it("names nobody when the whole room is level — the Week 1 state", () => {
    // The bug this exists for: 25 players on 500 each, and the rail crowned one of them.
    const state = leaderFrom(Array.from({ length: 25 }, (_, i) => row(`P${i}`, 500)));
    expect(state).toEqual({ kind: "tied", count: 25, stack: 500 });
  });

  it("names the leader only when one player is clear of the field", () => {
    expect(leaderFrom([row("Steven", 640), row("Dee", 500), row("Frank", 480)])).toEqual({
      kind: "leader",
      name: "Steven S.",
      stack: 640,
    });
  });

  it("reports a two-way tie at the top as a tie, not as whoever sorted first", () => {
    expect(leaderFrom([row("Dee", 640), row("Steven", 640), row("Frank", 480)])).toEqual({
      kind: "tied",
      count: 2,
      stack: 640,
    });
  });

  it("ignores deactivated players, who keep their chips but have left the room (§13)", () => {
    const state = leaderFrom([row("Ghost", 2000, "deactivated"), row("Steven", 640), row("Dee", 500)]);
    expect(state).toEqual({ kind: "leader", name: "Steven S.", stack: 640 });
  });

  it("does not resurrect a deactivated leader as a tie either", () => {
    const state = leaderFrom([row("Ghost", 640, "deactivated"), row("Steven", 640), row("Dee", 500)]);
    expect(state).toEqual({ kind: "leader", name: "Steven S.", stack: 640 });
  });

  it("says nothing at all when there is no live roster", () => {
    expect(leaderFrom([])).toEqual({ kind: "none" });
    expect(leaderFrom([row("Pending", null)])).toEqual({ kind: "none" });
    expect(leaderFrom([row("Ghost", 900, "deactivated")])).toEqual({ kind: "none" });
  });

  it("leads on the stack after the ante, because the ledger already carries it", () => {
    // Not a behaviour of this function so much as a statement of what feeds it: the
    // standings stack is SUM(ledger), and slate open posts the ante, so a Week 1 board
    // reads 490 rather than 500 the moment the week opens.
    expect(leaderFrom([row("Steven", 490), row("Dee", 480)])).toEqual({
      kind: "leader",
      name: "Steven S.",
      stack: 490,
    });
  });
});
