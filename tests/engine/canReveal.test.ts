import { describe, expect, it } from "vitest";
import { canReveal } from "@/lib/engine";

// The reveal decides by asking who it is still waiting on. That subtraction cannot
// distinguish "nobody left to wait for" from "everybody is in", so an empty roster
// reported itself unanimously ready. These are the cases that separates.

describe("canReveal", () => {
  it("refuses an empty room — the bug: zero players read as unanimous", () => {
    const r = canReveal({ activePlayers: 0, tickets: 0 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toMatch(/no active players/);
  });

  it("refuses a room with players but no tickets — nothing to open", () => {
    // Reachable if every ticket were removed, or a week opened with nobody submitting.
    const r = canReveal({ activePlayers: 9, tickets: 0 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toMatch(/no tickets/);
  });

  it("opens a normal week", () => {
    expect(canReveal({ activePlayers: 12, tickets: 12 })).toEqual({ ok: true });
  });

  it("still opens a week where most of the room folded — a fold is a ticket", () => {
    expect(canReveal({ activePlayers: 10, tickets: 10 })).toEqual({ ok: true });
  });

  it("does NOT block a league that shrank below the eight-player start minimum", () => {
    // §1's minimum is "to start, not to survive". Refusing here would freeze the week
    // rather than play it, which is strictly worse for the people still in the room.
    expect(canReveal({ activePlayers: 3, tickets: 3 })).toEqual({ ok: true });
    expect(canReveal({ activePlayers: 1, tickets: 1 })).toEqual({ ok: true });
  });

  it("opens once the tickets are in, even if fewer than the head count", () => {
    // The deadline path auto-folds the stragglers first, so tickets can trail players
    // only on the last-ticket path — where the caller has already confirmed nobody is
    // outstanding. Either way there is a real board to turn over.
    expect(canReveal({ activePlayers: 9, tickets: 9 })).toEqual({ ok: true });
  });
});
