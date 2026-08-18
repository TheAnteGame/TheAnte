// Pure routing table (ANTE-PLAYER §3), split out from lib/player.ts so it has no
// server-only/Clerk/DB imports and can be unit-tested directly (see player.test.ts).

export interface PlayerState {
  clerkUserId: string;
  player: {
    id: string;
    status: "pending" | "approved" | "rejected" | "deactivated";
    profileComplete: boolean;
    firstName: string | null;
    howToPlayAcceptedAt: string | null;
  } | null;
  rosterLocked: boolean;
}

/** The routing table from ANTE-PLAYER §3. One place, used by every gate. */
export function routeFor(state: PlayerState): string {
  const { player, rosterLocked } = state;
  if (!player) return rosterLocked ? "/closed" : "/join";
  switch (player.status) {
    case "rejected":
      return "/closed";
    case "pending":
      return player.profileComplete ? "/waiting" : "/onboarding";
    case "deactivated":
      // A deactivated player can only have arrived via "approved" — they've already
      // passed the how-to-play gate once. Present-but-inactive, never re-onboarded.
      return player.profileComplete ? "/dashboard" : "/onboarding";
    case "approved":
      if (!player.profileComplete) return "/onboarding";
      if (!player.howToPlayAcceptedAt) return "/how-to-play";
      return "/dashboard";
  }
}
