"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createUserClient } from "@/lib/db/supabase";
import { getPlayerState, routeFor } from "@/lib/player";
import { serviceDb } from "@/lib/jobs/util";
import { emailDoc } from "@/lib/notify/templates";
import { applicationReceived } from "@/lib/notify/docs";

// Mutations run as the requesting user, through RLS (ANTE-TECH §4.2). The
// players_apply policy admits only a pending self-row; the self-update guard
// trigger confines edits to profile fields. Every action re-checks auth itself —
// middleware is not authorization (ANTE-ADMIN §2).

/** A verified phone with no player record creates a pending application (§3.1) —
 *  unless the Week 1 roster lock has passed: everybody starts at 500 on the same
 *  Thursday or not at all (§1). */
export async function ensurePlayer(): Promise<string> {
  const state = await getPlayerState();
  if (!state) return "/";
  if (state.player) return routeFor(state);
  if (state.rosterLocked) return "/closed"; // no pending record is created (§3.1)

  // The verified number rides along at creation (D-047). It is the one moment it can
  // be written through the user client: players_apply checks only clerk_user_id and
  // status, while the self-update guard blocks any LATER change to phone — a player
  // may never edit it, which is the point. Absent means Clerk had none to give.
  const cu = await currentUser();
  const phone = cu?.primaryPhoneNumber?.phoneNumber ?? cu?.phoneNumbers?.[0]?.phoneNumber ?? null;

  const db = createUserClient();
  const { error } = await db.from("players").insert({
    clerk_user_id: state.clerkUserId,
    status: "pending",
    ...(phone ? { phone } : {}),
  });
  // A concurrent insert (double tap) hits the unique constraint — that's fine.
  if (error && !error.message.includes("duplicate key")) {
    throw new Error(`application failed: ${error.message}`);
  }
  return "/onboarding";
}

const ProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  email: z.string().trim().email().max(200),
  favoriteTeam: z.string().trim().length(2).or(z.string().trim().length(3)),
});

export async function saveProfile(formData: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const parsed = ProfileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    favoriteTeam: formData.get("favoriteTeam"),
  });
  if (!parsed.success) redirect("/onboarding?error=1");

  const db = createUserClient();
  const { error } = await db
    .from("players")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email,
      favorite_team: parsed.data.favoriteTeam,
      profile_complete: true,
    })
    .eq("clerk_user_id", userId);
  if (error) redirect("/onboarding?error=1");

  // The waiting-room email (D-056). This is the first moment we have an address at
  // all: sign-in is phone OTP and the email is collected right here. Only sent while
  // they are still pending, so re-saving the profile cannot send it twice.
  const { data: me } = await db
    .from("players")
    .select("id, email, status, first_name")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (me && me.status === "pending") {
    // Wrapped: the profile is already saved. A mail problem must not bounce them back
    // to the onboarding form with an error over an email they never asked for.
    try {
      await emailDoc(
        serviceDb(),
        { id: me.id, email: me.email },
        "player.application_received",
        "ANTE: you're on the list",
        applicationReceived({ firstName: me.first_name ?? "Hello" }),
        `player.application_received:${me.id}`,
      );
    } catch (e) {
      console.error(`application mail failed for ${me.id}:`, e);
    }
  }

  const state = await getPlayerState();
  redirect(state ? routeFor(state) : "/");
}

/** The how-to-play tutorial's accept step — no fields to validate, just a commitment
 *  timestamp (§how-to-play gate). Self-editable: not in the players self-update denylist. */
export async function acceptHowToPlay(): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const db = createUserClient();
  const { error } = await db
    .from("players")
    .update({ how_to_play_accepted_at: new Date().toISOString() })
    .eq("clerk_user_id", userId);
  if (error) redirect("/how-to-play?error=1");

  const state = await getPlayerState();
  redirect(state ? routeFor(state) : "/");
}
