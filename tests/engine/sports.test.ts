import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/sports/csv";
import { kickoffFromNflverse, weekAnchors } from "@/lib/time";
import { DateTime } from "luxon";

describe("CSV parsing", () => {
  it("handles quoted fields with embedded commas and quotes", () => {
    const rows = parseCsv('a,b,c\n1,"x, y",\'\n2,"say ""hi""",z\n');
    expect(rows).toEqual([
      { a: "1", b: "x, y", c: "'" },
      { a: "2", b: 'say "hi"', c: "z" },
    ]);
  });
  it("handles CRLF and trailing newline", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([{ a: "1", b: "2" }]);
  });
});

describe("kickoffs and week anchors (ET, DST-safe — ANTE-TECH §4.5)", () => {
  it("builds kickoff instants in America/New_York", () => {
    const kick = kickoffFromNflverse("2026-09-09", "20:20");
    const et = DateTime.fromJSDate(kick).setZone("America/New_York");
    expect(et.toFormat("cccc HH:mm")).toBe("Wednesday 20:20");
    expect(et.offset).toBe(-4 * 60); // EDT in September
  });

  it("Week 1 2026: Wednesday opener anchors to Tue Sep 8 6:00am ET / Thu Sep 10 noon", () => {
    const { opensAt, deadlineAt } = weekAnchors(kickoffFromNflverse("2026-09-09", "20:20"));
    const open = DateTime.fromJSDate(opensAt).setZone("America/New_York");
    const dead = DateTime.fromJSDate(deadlineAt).setZone("America/New_York");
    expect(open.toFormat("cccc yyyy-MM-dd HH:mm")).toBe("Tuesday 2026-09-08 06:00");
    expect(dead.toFormat("cccc yyyy-MM-dd HH:mm")).toBe("Thursday 2026-09-10 12:00");
  });

  it("Week 10 spans the November DST change and the deadline stays at noon ET", () => {
    // DST ends Sun Nov 1 2026. A Thursday Nov 5 game week: anchors must be clean ET.
    const { opensAt, deadlineAt } = weekAnchors(kickoffFromNflverse("2026-11-05", "20:15"));
    const open = DateTime.fromJSDate(opensAt).setZone("America/New_York");
    const dead = DateTime.fromJSDate(deadlineAt).setZone("America/New_York");
    expect(open.toFormat("cccc HH:mm")).toBe("Tuesday 06:00");
    expect(dead.toFormat("cccc HH:mm")).toBe("Thursday 12:00");
    expect(dead.offset).toBe(-5 * 60); // EST after the change — tz database, not offsets
  });

  it("a Sunday-first week (all early games gone) still anchors to its own Tuesday", () => {
    const { opensAt } = weekAnchors(kickoffFromNflverse("2026-09-13", "13:00"));
    const open = DateTime.fromJSDate(opensAt).setZone("America/New_York");
    expect(open.toFormat("cccc yyyy-MM-dd")).toBe("Tuesday 2026-09-08");
  });
});
