"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/db/supabase";
import { getPlayerState } from "@/lib/player";

// Posting runs as the player: the chat_post RLS policy enforces approved status and
// the mute (a muted player can read and can still bet — ANTE-ADMIN §4.3).

export interface PostResult {
  ok: boolean;
  error?: string;
}

export async function postChatMessage(formData: FormData): Promise<PostResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Not signed in" };

  const body = String(formData.get("body") ?? "").trim();
  if (body.length === 0) return { ok: false };
  if (body.length > 2000) return { ok: false, error: "2000 characters is the cap." };

  const state = await getPlayerState();
  if (!state?.player) return { ok: false, error: "No seat" };

  const db = createUserClient();
  const { error } = await db.from("chat_messages").insert({ player_id: state.player.id, body });
  if (error) return { ok: false, error: "That didn't post." };

  revalidatePath("/dashboard");
  return { ok: true };
}
