import { describe, expect, it } from "vitest";
import { mentionsTeam } from "./mentions";

describe("mentionsTeam", () => {
  it("matches the nickname anywhere in a headline", () => {
    expect(mentionsTeam("Broncos rule WR Mims (foot) out vs. Jaguars", "Broncos")).toBe(true);
    expect(mentionsTeam("Nix, Broncos 'not freaking out' after bad loss", "Broncos")).toBe(true);
    expect(mentionsTeam("Jaguars vs. Broncos: Jacksonville aims for 10th", "Broncos")).toBe(true);
  });

  it("survives a possessive and an HTML entity, which the feeds are full of", () => {
    expect(mentionsTeam("Chiefs&#039; Travis Kelce admits he got away with it", "Chiefs")).toBe(true);
    expect(mentionsTeam("Broncos' home opener", "Broncos")).toBe(true);
  });

  it("takes the singular", () => {
    expect(mentionsTeam("A Bronco to watch this week", "Broncos")).toBe(true);
  });

  it("refuses the substrings a bare LIKE would swallow", () => {
    expect(mentionsTeam("Jalen Ramsey traded to Pittsburgh", "Rams")).toBe(false);
    expect(mentionsTeam("Inside the NFL's youth programs", "Rams")).toBe(false);
    expect(mentionsTeam("Named chiefs of staff for the league office", "Chiefs")).toBe(true);
    expect(mentionsTeam("Giantsbane signs with the XFL", "Giants")).toBe(false);
    expect(mentionsTeam("Packers lose WR Reed to injury", "Broncos")).toBe(false);
  });

  it("is empty-safe", () => {
    expect(mentionsTeam("Broncos win", "")).toBe(false);
  });
});
