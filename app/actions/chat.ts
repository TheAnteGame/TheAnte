"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/db/supabase";
import { serviceDb } from "@/lib/jobs/util";
import { getPlayerState } from "@/lib/player";
import { emailPlayer } from "@/lib/notify/templates";
import { getContent } from "@/lib/content/getContent";
import { buildHandles, findMentioned, MAX_MENTIONS_PER_MESSAGE } from "@/lib/chat/mentions";

// Posting runs as the player: the chat_post RLS policy enforces approved status and
// the mute (a muted player can read and can still bet — ANTE-ADMIN §4.3).

export interface PostResult {
  ok: boolean;
  error?: string;
}

/** Email anyone named in the message (D-019). Never the author, never more than the cap. */
async function notifyMentions(messageId: string, authorId: string, authorName: string, body: string): Promise<void> {
  const db = serviceDb();
  const { data: roster } = await db
    .from("players")
    .select("id, first_name, last_name, email")
    .eq("status", "approved");
  if (!roster || roster.length === 0) return;

  const handles = buildHandles(roster.map((p) => ({ id: p.id, firstName: p.first_name, lastName: p.last_name })));
  const mentioned = findMentioned(body, handles)
    .filter((id) => id !== authorId)
    .slice(0, MAX_MENTIONS_PER_MESSAGE);
  if (mentioned.length === 0) return;

  const subject = await getContent("notify.mention_subject", { author: authorName });
  for (const id of mentioned) {
    const player = roster.find((p) => p.id === id);
    if (!player?.email) continue;
    await emailPlayer(
      db,
      { id: player.id, email: player.email },
      "notify.mention",
      subject,
      { author: authorName, message: body },
      // One notice per person per message, however many times they are named in it.
      `mention-${messageId}`,
      { allowFreeText: true },
    );
  }
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
  const { data: posted, error } = await db
    .from("chat_messages")
    .insert({ player_id: state.player.id, body })
    .select("id")
    .single();
  if (error || !posted) return { ok: false, error: "That didn't post." };

  // Best-effort: a failed notification must never cost the player their message.
  try {
    await notifyMentions(posted.id, state.player.id, state.player.firstName ?? "Someone", body);
  } catch {
    /* swallowed on purpose — the message is posted and visible */
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
