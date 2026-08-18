import "server-only";
import { auth } from "@clerk/nextjs/server";
import { serviceDb } from "@/lib/jobs/util";
import { routeFor, type PlayerState } from "@/lib/playerRouting";

// Roster-state lookup for routing. This is an internal system check (which page does
// this person see), not a data surface — player-visible data always flows through
// the user client under RLS. Ticket reads never happen here.

export { routeFor };
export type { PlayerState };

export async function getPlayerState(): Promise<PlayerState | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const db = serviceDb();
  const [{ data: player }, { data: season }] = await Promise.all([
    db
      .from("players")
      .select("id, status, profile_complete, first_name, how_to_play_accepted_at")
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
          howToPlayAcceptedAt: player.how_to_play_accepted_at,
        }
      : null,
    rosterLocked,
  };
}
