import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { BoardHeader } from "@/components/wager/BoardHeader";

// D-103. The Past Weeks door was added to ONE of the three components that render
// the Game Board header, so it showed in every state except an open week — the only
// state where the archive has no other entrance. The render tests below cover the
// header itself; the source test is the one that matters, because it fails if a
// board state grows its own header again.

const BOARD_FILES = [
  "components/wager/WagerArea.tsx",
  "components/wager/BetSlip.tsx",
  "components/wager/SettledResults.tsx",
];

describe("BoardHeader", () => {
  it("shows the door when there is a revealed week to go back to", () => {
    const html = renderToString(<BoardHeader heading="Game Board" pastWeek={2} pastLabel="Past Weeks" />);
    expect(html).toContain("Game Board");
    expect(html).toContain("Past Weeks");
    expect(html).toContain('href="/results/2"');
  });

  it("shows no door before any week has revealed", () => {
    const html = renderToString(<BoardHeader heading="Game Board" pastWeek={null} pastLabel="Past Weeks" />);
    expect(html).toContain("Game Board");
    expect(html).not.toContain("Past Weeks");
    expect(html).not.toContain("/results/");
  });
});

describe("every board state uses the shared header", () => {
  for (const file of BOARD_FILES) {
    it(`${file} renders BoardHeader and not its own`, () => {
      const src = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
      expect(src).toContain("<BoardHeader");
      // A raw panel-head <h2> here means this state has drifted back to its own copy.
      expect(src).not.toMatch(/className="panel-head[^"]*"\s*>\s*\n?\s*\{?\s*(heading|copy\.heading)/);
    });
  }
});
