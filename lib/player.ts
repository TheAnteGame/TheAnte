import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { serviceDb } from "@/lib/jobs/util";
import { routeFor, type PlayerState } from "@/lib/playerRouting";

// Roster-state lookup for routing. This is an internal system check (which page does
// this person see), not a data surface — player-visible data always flows through
// the user client under RLS. Ticket reads never happen here.

export { routeFor };
export type { PlayerState };

/** Clerk's verified number, written with the service role on purpose: the self-update
 *  guard forbids a player changing their own phone ("phone changes are a Clerk flow"),
 *  and that stays true — this copies what Clerk already verified, it does not accept a
 *  number from anybody. Never allowed to break a page render. */
async function adoptClerkPhone(clerkUserId: string): Promise<void> {
  try {
    const u = await currentUser();
    const phone = u?.primaryPhoneNumber?.phoneNumber ?? u?.phoneNumbers?.[0]?.phoneNumber ?? null;
    if (!phone) return;
    await serviceDb().from("players").update({ phone }).eq("clerk_user_id", clerkUserId).is("phone", null);
  } catch {
    // Clerk unreachable, or no phone on the account. The roster shows a blank cell,
    // which is exactly what it showed before. Nothing else depends on this.
  }
}

export async function getPlayerState(): Promise<PlayerState | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const db = serviceDb();
  const [{ data: player }, { data: season }] = await Promise.all([
    db
      .from("players")
      .select("id, status, profile_complete, first_name, how_to_play_accepted_at, phone")
      .eq("clerk_user_id", userId)
      .maybeSingle(),
    db.from("seasons").select("week1_lock_at, status").order("year", { ascending: false }).limit(1).maybeSingle(),
  ]);

  // Clerk owns the verified phone — it is the only way into this league (phone OTP,
  // required, D-001) — but nothing ever copied it into the players row, so the admin
  // roster showed a blank Contact for anyone whose number had not been typed in by
  // hand (D-047). New players now get it at sign-up; this heals the ones who joined
  // before that, the next time they load any page. Runs once per player: after the
  // write, phone is non-null and the branch is never taken again.
  if (player && !player.phone) await adoptClerkPhone(userId);

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
