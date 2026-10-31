import { describe, expect, it } from "vitest";
import { lapSeconds, REFERENCE_RAIL_PX } from "./lap";

const pxPerSecond = (setting: number, copyW: number) => copyW / lapSeconds(setting, copyW);

describe("lapSeconds", () => {
  it("holds pixels-per-second steady however much news is on the rail", () => {
    const speeds = [900, 2600, 5600].map((copyW) => Math.round(pxPerSecond(15, copyW)));
    expect(new Set(speeds).size).toBe(1);
    expect(speeds[0]).toBe(Math.round(REFERENCE_RAIL_PX / 15));
  });

  it("is what the old behaviour was not: the same setting used to vary 6x", () => {
    const old = (copyW: number) => copyW / 15;
    expect(Math.round(old(5600) / old(900))).toBe(6);
  });

  it("moves at the same speed on a phone as on a computer (D-126)", () => {
    // The lap no longer depends on the rail on screen at all; the old formula
    // (setting × copy ÷ rail on screen) ran a 340px phone rail at 340/1152 of the speed.
    const oldPhone = 900 / ((15 * 900) / 340);
    expect(Math.round(pxPerSecond(15, 900))).toBe(Math.round(REFERENCE_RAIL_PX / 15));
    expect(oldPhone).toBeLessThan(pxPerSecond(15, 900) / 3);
  });

  it("a lower setting is always faster", () => {
    for (const copyW of [900, 2600, 5600]) {
      expect(pxPerSecond(15, copyW)).toBeGreaterThan(pxPerSecond(40, copyW));
      expect(pxPerSecond(40, copyW)).toBeGreaterThan(pxPerSecond(180, copyW));
    }
  });

  it("scales the lap by how wide the item set is", () => {
    expect(lapSeconds(15, REFERENCE_RAIL_PX)).toBeCloseTo(15);
    expect(lapSeconds(15, REFERENCE_RAIL_PX * 2)).toBeCloseTo(30);
  });

  it("falls back to the setting when nothing has been measured yet", () => {
    expect(lapSeconds(40, 0)).toBe(40);
  });

  it("never returns a flicker", () => {
    expect(lapSeconds(15, 1)).toBe(2);
    expect(lapSeconds(0, 900)).toBe(2);
  });
});
