import { describe, expect, it } from "vitest";
import { routeFor, type PlayerState } from "@/lib/playerRouting";

// The routing table (§how-to-play gate): every page gate calls getPlayerState() then
// routeFor() and redirects on mismatch, so this one function is the whole gate.

function state(overrides: Partial<NonNullable<PlayerState["player"]>> | null, rosterLocked = false): PlayerState {
  return {
    clerkUserId: "user_1",
    rosterLocked,
    player: overrides
      ? {
          id: "p1",
          status: "approved",
          profileComplete: true,
          firstName: "Robert",
          howToPlayAcceptedAt: null,
          ...overrides,
        }
      : null,
  };
}

describe("routeFor", () => {
  it("sends an unauthenticated visitor to /join, or /closed once the roster is locked", () => {
    expect(routeFor(state(null))).toBe("/join");
    expect(routeFor(state(null, true))).toBe("/closed");
  });

  it("sends a rejected player to /closed", () => {
    expect(routeFor(state({ status: "rejected" }))).toBe("/closed");
  });

  it("sends a pending player to /onboarding or /waiting by profile completeness", () => {
    expect(routeFor(state({ status: "pending", profileComplete: false }))).toBe("/onboarding");
    expect(routeFor(state({ status: "pending", profileComplete: true }))).toBe("/waiting");
  });

  it("gates an approved player through onboarding, then how-to-play, then the dashboard", () => {
    expect(routeFor(state({ status: "approved", profileComplete: false }))).toBe("/onboarding");
    expect(routeFor(state({ status: "approved", profileComplete: true, howToPlayAcceptedAt: null }))).toBe(
      "/how-to-play",
    );
    expect(
      routeFor(state({ status: "approved", profileComplete: true, howToPlayAcceptedAt: "2026-08-18T00:00:00Z" })),
    ).toBe("/dashboard");
  });

  it("sends a deactivated player straight to /dashboard once their profile is complete, skipping how-to-play", () => {
    expect(routeFor(state({ status: "deactivated", profileComplete: false }))).toBe("/onboarding");
    expect(
      routeFor(state({ status: "deactivated", profileComplete: true, howToPlayAcceptedAt: null })),
    ).toBe("/dashboard");
  });
});
