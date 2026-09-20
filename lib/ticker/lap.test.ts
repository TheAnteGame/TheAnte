import { describe, expect, it } from "vitest";
import { lapSeconds } from "./lap";

const pxPerSecond = (setting: number, copyW: number, railW: number) => copyW / lapSeconds(setting, copyW, railW);

describe("lapSeconds", () => {
  it("holds pixels-per-second steady however much news is on the rail", () => {
    const rail = 1152;
    const speeds = [900, 2600, 5600].map((copyW) => Math.round(pxPerSecond(15, copyW, rail)));
    expect(new Set(speeds).size).toBe(1);
    expect(speeds[0]).toBe(Math.round(rail / 15));
  });

  it("is what the old behaviour was not: the same setting used to vary 6x", () => {
    const old = (copyW: number) => copyW / 15;
    expect(Math.round(old(5600) / old(900))).toBe(6);
  });

  it("a lower setting is always faster, on any rail", () => {
    for (const copyW of [900, 2600, 5600]) {
      expect(pxPerSecond(15, copyW, 1152)).toBeGreaterThan(pxPerSecond(40, copyW, 1152));
      expect(pxPerSecond(40, copyW, 1152)).toBeGreaterThan(pxPerSecond(180, copyW, 1152));
    }
  });

  it("scales the lap by how wide the item set is", () => {
    expect(lapSeconds(15, 1152, 1152)).toBeCloseTo(15);
    expect(lapSeconds(15, 2304, 1152)).toBeCloseTo(30);
  });

  it("falls back to the setting when nothing has been measured yet", () => {
    expect(lapSeconds(40, 0, 1152)).toBe(40);
    expect(lapSeconds(40, 900, 0)).toBe(40);
  });

  it("never returns a flicker", () => {
    expect(lapSeconds(15, 1, 100000)).toBe(2);
    expect(lapSeconds(0, 900, 1152)).toBe(2);
  });
});
