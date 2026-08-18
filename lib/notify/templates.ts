import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { contentDefaults } from "@/lib/content/defaults";
import { send } from "./index";

// Template rendering + logged sends. Templates are content-managed (notify.* keys);
// variables are a WHITELIST passed by the calling job — that is how the blackout
// rule is enforced by construction: no pick data ever reaches a template variable,
// so no rendered body can leak one (ANTE-TECH §3.3, §7). As a second fence, no
// send is attempted with a body containing a "{" — an unfilled variable means a
// template edit went wrong, and we fail loud rather than send garbage.

async function template(db: SupabaseClient, key: string): Promise<string> {
  const { data } = await db.from("content_blocks").select("value").eq("key", key).maybeSingle();
  return data?.value ?? contentDefaults[key] ?? "";
}

export function fill(text: string, vars: Record<string, string | number>): string {
  let out = text;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

export async function emailPlayer(
  db: SupabaseClient,
  player: { id: string; email: string | null },
  templateKey: string,
  subject: string,
  vars: Record<string, string | number>,
  dedupeKey?: string,
): Promise<void> {
  if (!player.email) return;

  // Idempotency: one send per (player, dedupe key), checked against the log.
  const logKey = dedupeKey ?? templateKey;
  if (dedupeKey) {
    const { data: existing } = await db
      .from("notification_log")
      .select("id")
      .eq("player_id", player.id)
      .eq("template_key", logKey)
      .in("status", ["sent", "queued"])
      .limit(1);
    if (existing && existing.length > 0) return;
  }

  const body = fill(await template(db, templateKey), vars);
  if (body.includes("{") || body.trim().length === 0) {
    await db.from("notification_log").insert({
      player_id: player.id,
      channel: "email",
      template_key: logKey,
      body,
      status: "failed",
      error: "template has unfilled variables or is empty",
    });
    return;
  }

  const result = await send("email", templateKey, player.email, { subject, body });
  await db.from("notification_log").insert({
    player_id: player.id,
    channel: "email",
    template_key: logKey,
    body,
    status: result.status,
    provider_message_id: result.providerMessageId ?? null,
    error: result.error ?? null,
  });
}

export async function emailAllApproved(
  db: SupabaseClient,
  templateKey: string,
  subject: string,
  vars: Record<string, string | number>,
  dedupeKey: string,
): Promise<number> {
  const { data: players } = await db.from("players").select("id, email").eq("status", "approved");
  let sent = 0;
  for (const p of players ?? []) {
    await emailPlayer(db, p, templateKey, subject, vars, dedupeKey);
    sent++;
  }
  return sent;
}
