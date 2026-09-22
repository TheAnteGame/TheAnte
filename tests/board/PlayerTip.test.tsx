import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { PlayerTip } from "@/components/ui/PlayerTip";

// D-104. Every player name is a door to their season. With no id to hand it must
// fall back to the identity tray rather than render a link to nowhere.

describe("PlayerTip", () => {
  it("makes the name a link to that player's season", () => {
    const html = renderToString(
      <PlayerTip fullName="Melissa W." team="Denver Broncos" playerId="11111111-1111-4111-8111-111111111111">
        <span>Melissa W.</span>
      </PlayerTip>,
    );
    expect(html).toContain('href="/player/11111111-1111-4111-8111-111111111111"');
    expect(html).toContain("Denver Broncos");
    // A link, not the toggle button — a button here would swallow the navigation.
    expect(html).not.toContain("<button");
  });

  it("falls back to the identity tray when there is no id", () => {
    const html = renderToString(
      <PlayerTip fullName="Melissa W." team={null}>
        <span>Melissa W.</span>
      </PlayerTip>,
    );
    expect(html).toContain("<button");
    expect(html).not.toContain("/player/");
  });
});
