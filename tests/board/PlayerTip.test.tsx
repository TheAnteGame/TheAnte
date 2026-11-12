import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { PlayerTip } from "@/components/ui/PlayerTip";

// D-104. Every player name is a door to their season. D-135: no hover tray — the name
// is just the link, and with no id to hand it is plain text, never a link to nowhere.

describe("PlayerTip", () => {
  it("makes the name a link to that player's season, with no tray", () => {
    const html = renderToString(
      <PlayerTip fullName="Melissa W." team="Denver Broncos" playerId="11111111-1111-4111-8111-111111111111">
        <span>Melissa W.</span>
      </PlayerTip>,
    );
    expect(html).toContain('href="/player/11111111-1111-4111-8111-111111111111"');
    expect(html).not.toContain('role="tooltip"');
    expect(html).not.toContain("Denver Broncos");
    // A link, not a toggle button — a button here would swallow the navigation.
    expect(html).not.toContain("<button");
  });

  it("renders plain text when there is no id", () => {
    const html = renderToString(
      <PlayerTip fullName="Melissa W." team={null}>
        <span>Melissa W.</span>
      </PlayerTip>,
    );
    expect(html).toContain("Melissa W.");
    expect(html).not.toContain("<button");
    expect(html).not.toContain('role="tooltip"');
    expect(html).not.toContain("/player/");
  });
});
