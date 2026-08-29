import { describe, expect, it } from "vitest";
import { render } from "@/lib/notify/render";
import * as D from "@/lib/notify/docs";

// The five league emails, checked for the two properties that are easy to lose by
// hand: no em dashes anywhere (owner's house style, D-057), and genuine parity
// between the HTML and the plain-text rendering.

const DOCS = {
  applicationReceived: D.applicationReceived({ firstName: "Steve" }),
  approved: D.approved({ firstName: "Steve", phone: "(602) 555-8921" }),
  approvedNoPhone: D.approved({ firstName: "Steve", phone: null }),
  ticket: D.ticket({
    firstName: "Steve", week: 1, folded: false, isShove: false, deadline: "Thursday 12:00pm ET", total: 70,
    bets: [{ team: "LA", matchup: "SF @ LA", chips: 50 }, { team: "CHI", matchup: "CHI @ CAR", chips: 20 }],
  }),
  folded: D.ticket({ firstName: "Steve", week: 1, folded: true, isShove: false, deadline: "Thursday 12:00pm ET", total: 0, bets: [] }),
  reveal: D.reveal({
    firstName: "Steve", week: 1, folded: "Kegan L. was folded automatically.",
    games: [{ matchup: "SF @ LA", away: "SF", home: "LA", awayBackers: "Justin G.", homeBackers: "Steve M." }],
  }),
  weekOpen: D.weekOpen({
    firstName: "Steve", week: 2, ante: 10, limit: 160, deadline: "Thursday 12:00pm ET", prevWeek: 1,
    delta: "+85", stack: 575, rank: "2nd", potWinner: "Justin G.", potAmount: 70,
    leaders: [{ rank: "1", name: "Justin G.", stack: "612", delta: "+122" }],
  }),
  weekOne: D.weekOpen({
    firstName: "Steve", week: 1, ante: 10, limit: 160, deadline: "Thursday 12:00pm ET", prevWeek: null,
    delta: "", stack: 500, rank: "", potWinner: "", potAmount: 0, leaders: [],
  }),
};

describe("league emails", () => {
  for (const [name, doc] of Object.entries(DOCS)) {
    it(`${name}: renders no em dash in either format`, () => {
      const { html, text } = render(doc);
      expect(html).not.toContain("—");
      expect(text).not.toContain("—");
    });

    it(`${name}: HTML and text carry the same content`, () => {
      const { html, text } = render(doc);
      // Both must be non-trivial, and the text version must never be a stub.
      expect(text.length).toBeGreaterThan(200);
      expect(html).toContain("theantegame.com/logo.png");
      // Every headline and eyebrow reaches both renderings. The HTML uppercases via
      // CSS, so it carries the original casing; the text version uppercases literally.
      expect(html).toContain(doc.headline);
      expect(html).toContain(doc.eyebrow);
      expect(text).toContain(doc.headline.toUpperCase());
      expect(text).toContain(doc.eyebrow.toUpperCase());
      // No unfilled template braces survived into either.
      expect(html).not.toMatch(/\$\{/);
      expect(text).not.toMatch(/\$\{/);
    });

    it(`${name}: forces dark and stays inside Gmail's clipping limit`, () => {
      const { html } = render(doc);
      expect(html).toContain('name="color-scheme" content="dark"');
      expect(html).toContain('name="supported-color-schemes" content="dark"');
      expect(html.length).toBeLessThan(102_000);
    });
  }

  it("the approved email uses the player's phone when there is one", () => {
    expect(render(DOCS.approved).text).toContain("(602) 555-8921");
    expect(render(DOCS.approvedNoPhone).text).toContain("the same phone number you signed up with");
  });

  it("a folded ticket says so, and never lists bets", () => {
    const t = render(DOCS.folded).text;
    expect(t).toContain("YOU FOLDED");
    expect(t).not.toContain("WHAT YOU BACKED");
  });
});
