import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { pushReleaseAt } from "./quiet";
import { LEAGUE_TZ } from "@/lib/time";

const at = (iso: string) => DateTime.fromISO(iso, { zone: LEAGUE_TZ });
const local = (d: Date | null) => (d ? DateTime.fromJSDate(d).setZone(LEAGUE_TZ).toFormat("ccc HH:mm") : null);

describe("quiet hours (D-121)", () => {
  it("sends straight away between 9am and 10pm", () => {
    expect(pushReleaseAt(at("2026-11-04T09:00"))).toBeNull();
    expect(pushReleaseAt(at("2026-11-04T21:59"))).toBeNull();
  });

  it("holds a late-night push to 9am the next day", () => {
    expect(local(pushReleaseAt(at("2026-11-04T22:00")))).toBe("Thu 09:00");
    expect(local(pushReleaseAt(at("2026-11-04T23:30")))).toBe("Thu 09:00");
  });

  it("holds an early-morning push to 9am the same day — the Thursday final call", () => {
    expect(local(pushReleaseAt(at("2026-11-05T06:00")))).toBe("Thu 09:00");
  });

  it("holds the Tuesday week-open push to 10am", () => {
    expect(local(pushReleaseAt(at("2026-11-03T06:00"), 10))).toBe("Tue 10:00");
    expect(local(pushReleaseAt(at("2026-11-03T09:30"), 10))).toBe("Tue 10:00");
    expect(pushReleaseAt(at("2026-11-03T10:00"), 10)).toBeNull();
  });

  it("keeps 9am across the November clock change", () => {
    expect(DateTime.fromJSDate(pushReleaseAt(at("2026-10-30T23:00"))!).toUTC().toFormat("HH:mm")).toBe("15:00");
    expect(DateTime.fromJSDate(pushReleaseAt(at("2026-11-01T23:00"))!).toUTC().toFormat("HH:mm")).toBe("16:00");
  });
});
