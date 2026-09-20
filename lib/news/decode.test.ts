import { describe, expect, it } from "vitest";
import { decodeEntities } from "./decode";

describe("decodeEntities", () => {
  it("fixes the headline that put a raw entity on the dashboard", () => {
    expect(decodeEntities("Chiefs&#039; Travis Kelce admits he got away with it")).toBe(
      "Chiefs' Travis Kelce admits he got away with it",
    );
  });
  it("handles named, decimal and hex", () => {
    expect(decodeEntities("Rams &amp; 49ers")).toBe("Rams & 49ers");
    expect(decodeEntities("Nix&#8217;s night")).toBe("Nix’s night");
    expect(decodeEntities("Week&#x20;2")).toBe("Week 2");
  });
  it("leaves ordinary text and unknown entities alone", () => {
    expect(decodeEntities("Broncos win 20-7")).toBe("Broncos win 20-7");
    expect(decodeEntities("Cost &euro; a lot")).toBe("Cost &euro; a lot");
    expect(decodeEntities("A &notreal; thing")).toBe("A &notreal; thing");
  });
  it("does not mangle an out-of-range code point", () => {
    expect(decodeEntities("bad &#99999999;")).toBe("bad &#99999999;");
  });
});
