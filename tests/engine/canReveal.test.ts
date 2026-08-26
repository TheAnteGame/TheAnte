import { describe, expect, it } from "vitest";
import { canReveal, computeAdmission } from "@/lib/engine";

// canReveal judges the WEEK's room (dealt-in players), not the global roster —
// review D-036: gating on league-wide approved counts wedged a week permanently
// when the roster changed after submissions.

describe("canReveal", () => {
  it("refuses a dealt-in room with no tickets — the only impossible state", () => {
    // Reachable only pre-fold: revealDeadline folds non-submitters first, so on the
    // deadline path tickets always exist for a dealt-in room.
    const r = canReveal({ dealtIn: 9, tickets: 0 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toMatch(/no tickets/);
  });

  it("opens a normal week", () => {
    expect(canReveal({ dealtIn: 12, tickets: 12 })).toEqual({ ok: true });
  });

  it("reveals a week whose players deactivated after submitting — tickets deserve their reveal", () => {
    // The wedge this replaces: zero approved players league-wide used to refuse
    // forever, freezing the season, even with a full board of submitted tickets.
    expect(canReveal({ dealtIn: 9, tickets: 9 })).toEqual({ ok: true });
  });

  it("completes an EMPTY week so the season can advance", () => {
    // A week with nobody dealt in cannot gain players after its deadline, and
    // slate.open refuses to reopen an existing week. Refusing here would wedge the
    // season permanently; revealing an empty board is a harmless no-op. The
    // pre-deadline empty-room case (D-034's original bug) is revealCheck's guard,
    // not this one — only the deadline path reaches an empty week.
    expect(canReveal({ dealtIn: 0, tickets: 0 })).toEqual({ ok: true });
  });

  it("still opens a room where everyone folded — a fold is a ticket", () => {
    expect(canReveal({ dealtIn: 10, tickets: 10 })).toEqual({ ok: true });
  });
});

// The single-player admission arithmetic must match computeSlateOpen's per-player
// branch — the drift was real (review D-036): the job-layer copy anted a stack equal
// to the ante down to 0 with a 0 limit and no felt flag.

describe("computeAdmission", () => {
  it("admits a fresh 500 stack: ante paid, limit from the frozen median", () => {
    const a = computeAdmission(500, 10, 500);
    expect(a.felt).toBe(false);
    expect(a.houseLimit).toBe(160); // floor(min(490, 500) / 3 / 10) * 10
    expect(a.entries.map((e) => [e.account, e.kind, e.amount])).toEqual([
      ["self", "ante", -10],
      [null, "ante", 10],
    ]);
  });

  it("a stack below the ante is felt: no ante, the limit is the whole stack (§9)", () => {
    const a = computeAdmission(7, 10, 500);
    expect(a.felt).toBe(true);
    expect(a.houseLimit).toBe(7);
    expect(a.entries).toEqual([]);
  });

  it("a stack EQUAL to the ante pays it, takes the §9 floor chip, and lands on the felt", () => {
    // The exact case the old job-layer code got wrong: 20 − 20 = 0, below the
    // stack≥1 invariant. The engine pays the ante, draws the floor chip from the
    // Pot, marks them felt with a limit of 1.
    const a = computeAdmission(20, 20, 500);
    expect(a.felt).toBe(true);
    expect(a.houseLimit).toBe(1);
    expect(a.entries.map((e) => [e.account, e.kind, e.amount])).toEqual([
      ["self", "ante", -20],
      [null, "ante", 20],
      ["self", "felt_floor", 1],
      [null, "felt_floor", -1],
    ]);
    // Chips conserve: player nets −19, pot nets +19.
    const playerNet = a.entries.filter((e) => e.account === "self").reduce((s, e) => s + e.amount, 0);
    const potNet = a.entries.filter((e) => e.account === null).reduce((s, e) => s + e.amount, 0);
    expect(playerNet + potNet).toBe(0);
  });

  it("one chip above the felt line stays a normal admission", () => {
    const a = computeAdmission(21, 20, 500);
    expect(a.felt).toBe(false);
    expect(a.houseLimit).toBe(0); // floor(min(1, 500)/3/10)*10 — tiny stack, tiny week
    expect(a.entries).toHaveLength(2);
  });
});
