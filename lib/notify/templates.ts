import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { contentDefaults } from "@/lib/content/defaults";
import { send } from "./index";
import { render, type EmailDoc } from "./render";

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
  opts?: { allowFreeText?: boolean },
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

  const raw = await template(db, templateKey);
  const body = fill(raw, vars);
  // Normally an unfilled "{" in the result means a template edit went wrong. When a
  // variable carries player-written text, check the template's own placeholders
  // instead, so a message containing a brace is not mistaken for a broken template.
  const unfilled = opts?.allowFreeText
    ? [...raw.matchAll(/\{(\w+)\}/g)].some((m) => !(m[1] in vars))
    : body.includes("{");
  if (unfilled || body.trim().length === 0) {
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

/** Send one of the five designed league emails (lib/notify/docs.ts). Renders the doc
 *  to HTML and plain text from the same source, logs the send, and honours the same
 *  per-player dedupe key as emailPlayer.
 *
 *  These bypass the content_blocks template path on purpose: their bodies are
 *  structured documents, not a single string with {vars} in it, so the whitelist that
 *  guards that path does not apply. The blackout is instead guarded at each call site,
 *  which is where the caller actually knows whether a week has revealed. */
export async function emailDoc(
  db: SupabaseClient,
  player: { id: string; email: string | null },
  templateKey: string,
  subject: string,
  doc: EmailDoc,
  dedupeKey?: string,
): Promise<void> {
  if (!player.email) return;
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

  const { html, text } = render(doc);
  const result = await send("email", templateKey, player.email, { subject, body: text, html });
  await db.from("notification_log").insert({
    player_id: player.id,
    channel: "email",
    template_key: logKey,
    body: text,
    status: result.status,
    provider_message_id: result.providerMessageId ?? null,
    error: result.error ?? null,
  });
}
