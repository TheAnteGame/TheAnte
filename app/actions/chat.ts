"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/db/supabase";
import { serviceDb } from "@/lib/jobs/util";
import { getPlayerState } from "@/lib/player";
import { emailPlayer } from "@/lib/notify/templates";
import { getContent } from "@/lib/content/getContent";
import { buildHandles, findMentioned, findNamed, MAX_MENTIONS_PER_MESSAGE } from "@/lib/chat/mentions";
import { isReactionKind, NOTIFY_AT, reactionLine } from "@/lib/chat/reactions";

// Posting runs as the player: the chat_post RLS policy enforces approved status and
// the mute (a muted player can read and can still bet — ANTE-ADMIN §4.3).

export interface PostResult {
  ok: boolean;
  error?: string;
}

/** A player named in plain words (no @) is told at most this often (D-121): a thread
 *  arguing about Casey's bet should reach Casey once, not fifteen times. An @ is a
 *  deliberate tap on the shoulder and is never held back. */
const NAMED_COOLDOWN_MINUTES = 30;

/** Tell anyone named in the message (D-019, D-121): by @ handle, or by any word of
 *  the first name the app displays. Never the author, never more than the cap. */
async function notifyMentions(messageId: string, authorId: string, authorName: string, body: string): Promise<void> {
  const db = serviceDb();
  const { data: roster } = await db
    .from("players")
    .select("id, first_name, last_name, email")
    .eq("status", "approved");
  if (!roster || roster.length === 0) return;

  const people = roster.map((p) => ({ id: p.id, firstName: p.first_name, lastName: p.last_name }));
  const tagged = findMentioned(body, buildHandles(people));
  const named = findNamed(body, people).filter((id) => !tagged.includes(id));

  const since = new Date(Date.now() - NAMED_COOLDOWN_MINUTES * 60_000).toISOString();
  const recent = new Set<string>();
  if (named.length > 0) {
    const { data: rows } = await db
      .from("notification_log")
      .select("player_id")
      .in("player_id", named)
      .like("template_key", "mention-%")
      .gte("sent_at", since);
    for (const r of rows ?? []) recent.add(r.player_id);
  }

  const mentioned = [...tagged, ...named.filter((id) => !recent.has(id))]
    .filter((id) => id !== authorId)
    .slice(0, MAX_MENTIONS_PER_MESSAGE);
  if (mentioned.length === 0) return;

  const subject = await getContent("mail.mention.subject", { author: authorName });
  for (const id of mentioned) {
    const player = roster.find((p) => p.id === id);
    if (!player) continue;
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

/** The dock was opened, or was open when new messages arrived (D-086): stamp the
 *  player's own read mark. Self-update under RLS; no revalidation — the dashboard's
 *  five-second poll picks it up, and the dock shows zero while open regardless. */
export async function markChatRead(): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;
  const db = createUserClient();
  await db.from("players").update({ chat_read_at: new Date().toISOString() }).eq("clerk_user_id", userId);
}

/** React to a message, change your reaction, or (kind null) take it off (D-123). One
 *  per player per message. Muted players cannot react: a mute stops posting, and a
 *  reaction is a small post. Writes with the service role after these checks, the
 *  same shape as a poll vote. */
export async function reactToMessage(messageId: string, kind: string | null): Promise<{ ok: boolean }> {
  const { userId } = await auth();
  if (!userId) return { ok: false };
  const state = await getPlayerState();
  if (!state?.player || state.player.status !== "approved") return { ok: false };
  if (kind !== null && !isReactionKind(kind)) return { ok: false };
  const playerId = state.player.id;

  const db = serviceDb();
  const [{ data: me }, { data: msg }] = await Promise.all([
    db.from("players").select("is_muted, muted_until").eq("id", playerId).maybeSingle(),
    db.from("chat_messages").select("id, player_id, body, is_system, hidden_at").eq("id", messageId).maybeSingle(),
  ]);
  if (me?.is_muted && (!me.muted_until || new Date(me.muted_until) > new Date())) return { ok: false };
  if (!msg || msg.is_system || msg.hidden_at) return { ok: false };

  const { error } =
    kind === null
      ? await db.from("chat_reactions").delete().eq("message_id", messageId).eq("player_id", playerId)
      : await db
          .from("chat_reactions")
          .upsert({ message_id: messageId, player_id: playerId, kind, created_at: new Date().toISOString() }, { onConflict: "message_id,player_id" });
  if (error) return { ok: false };

  // Best-effort, like a mention: the reaction is saved whatever happens here.
  if (kind !== null && msg.player_id && msg.player_id !== playerId) {
    try {
      await notifyReactions(msg.player_id, messageId, msg.body);
    } catch {
      /* swallowed on purpose */
    }
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

/** The author hears about it once per message (D-123): when NOTIFY_AT other players
 *  have reacted. An email and a push, through the same path as every other notice, so
 *  quiet hours and email-off both apply; the dedupe key makes it once, ever. */
async function notifyReactions(authorId: string, messageId: string, body: string): Promise<void> {
  const db = serviceDb();
  const { data: rows } = await db.from("chat_reactions").select("player_id, kind").eq("message_id", messageId).neq("player_id", authorId);
  if (!rows || rows.length < NOTIFY_AT) return;
  const { data: author } = await db.from("players").select("id, email").eq("id", authorId).maybeSingle();
  if (!author) return;
  const subject = await getContent("mail.reactions.subject", { count: rows.length });
  const quote = body.length > 140 ? `${body.slice(0, 137).trimEnd()}…` : body;
  await emailPlayer(
    db,
    author,
    "notify.reactions",
    subject,
    { count: rows.length, reactions: reactionLine(rows), message: quote },
    `reactions-${messageId}`,
    {
      allowFreeText: true,
      eyebrow: "Table Talk",
      headline: "The table noticed",
      cta: { label: "See the room", href: "https://theantegame.com/dashboard" },
    },
  );
}
