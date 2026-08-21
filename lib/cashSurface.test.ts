import { describe, expect, it } from "vitest";
import { isCashSurface } from "./cashSurface";

// Rulebook §9 — "No cash surface, ever." The filter has to catch sportsbook marketing
// without eating ordinary football coverage, because the slip itself shows a spread and
// a moneyline and those words are unremarkable in a headline.
describe("isCashSurface", () => {
  it.each([
    "Use DraftKings promo code to get $150 in bonus bets by targeting NFL preseason",
    "FanDuel promo code: bet $5, get $200",
    "Best sportsbook offers for Week 1",
    "BetMGM bonus bets available now",
    "Claim your free bets before kickoff",
    "New sign-up bonus for ESPN BET users",
    "Week 1 NFL odds, lines, best bets, predictions: Computer model backs Eagles",
    "Best parlay picks for Sunday's slate",
  ])("refuses: %s", (title) => {
    expect(isCashSurface(title)).toBe(true);
  });

  it.each([
    "Seahawks WR Bobo suffers 'serious' knee injury",
    "Chiefs open as 3.5-point favorites over the Bills",
    "Broncos vs. Packers: how to watch the preseason opener",
    "Playoff odds shift after Week 1 upsets",
    "Cowboys cover the spread in a wild finish",
    "Jets name their starting quarterback",
    "Bills trade up in the draft to grab their best defensive lineman",
    "Lions' offensive line is the story of the preseason",
  ])("allows ordinary football coverage: %s", (title) => {
    expect(isCashSurface(title)).toBe(false);
  });
});
