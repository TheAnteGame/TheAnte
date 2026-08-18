import "server-only";
import { auth } from "@clerk/nextjs/server";
import { serviceDb } from "@/lib/jobs/util";

// Roster-state lookup for routing. This is an internal system check (which page does
// this person see), not a data surface — player-visible data always flows through
// the user client under RLS. Ticket reads never happen here.

export interface PlayerState {
  clerkUserId: string;
  player: {
    id: string;
    status: "pending" | "approved" | "rejected" | "deactivated";
    profileComplete: boolean;
    firstName: string | null;
  } | null;
  rosterLocked: boolean;
}

export async function getPlayerState(): Promise<PlayerState | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const db = serviceDb();
  const [{ data: player }, { data: season }] = await Promise.all([
    db
      .from("players")
      .select("id, status, profile_complete, first_name")
      .eq("clerk_user_id", userId)
      .maybeSingle(),
    db.from("seasons").select("week1_lock_at, status").order("year", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const rosterLocked =
    season?.week1_lock_at != null && new Date(season.week1_lock_at) <= new Date();

  return {
    clerkUserId: userId,
    player: player
      ? {
          id: player.id,
          status: player.status,
          profileComplete: player.profile_complete,
          firstName: player.first_name,
        }
      : null,
    rosterLocked,
  };
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
    case "approved":
      return player.profileComplete ? "/dashboard" : "/onboarding";
  }
}
