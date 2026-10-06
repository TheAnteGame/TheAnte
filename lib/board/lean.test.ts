import { describe, expect, it } from "vitest";
import { leanFor } from "./lean";

describe("leanFor (D-112)", () => {
  it("positive spread: home is the favourite", () => {
    expect(leanFor(3.5, 150, -180)).toEqual({ away: "DOG", home: "FAV" });
  });
  it("negative spread: away is the favourite", () => {
    expect(leanFor(-7, -300, 240)).toEqual({ away: "FAV", home: "DOG" });
  });
  it("the spread decides even if the moneyline disagrees", () => {
    expect(leanFor(1, -110, -105)).toEqual({ away: "DOG", home: "FAV" });
  });
  it("pick'em spread falls back to the moneyline", () => {
    expect(leanFor(0, -115, -105)).toEqual({ away: "FAV", home: "DOG" });
    expect(leanFor(null, 120, -140)).toEqual({ away: "DOG", home: "FAV" });
  });
  it("a true coin-flip is EVEN on both sides", () => {
    expect(leanFor(0, -110, -110)).toEqual({ away: "EVEN", home: "EVEN" });
    expect(leanFor(0)).toEqual({ away: "EVEN", home: "EVEN" });
  });
  it("no odds yet: nothing to show", () => {
    expect(leanFor(null)).toBeNull();
    expect(leanFor(null, null, -150)).toBeNull();
  });
});
