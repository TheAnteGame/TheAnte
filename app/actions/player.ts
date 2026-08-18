"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createUserClient } from "@/lib/db/supabase";
import { getPlayerState, routeFor } from "@/lib/player";

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

  const db = createUserClient();
  const { error } = await db.from("players").insert({
    clerk_user_id: state.clerkUserId,
    status: "pending",
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
