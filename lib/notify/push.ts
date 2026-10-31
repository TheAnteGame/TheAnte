import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { DateTime } from "luxon";
import type { EmailDoc } from "./render";
import { pushReleaseAt } from "./quiet";

// Phone notifications by web push (D-120). A push is never its own message: it is
// the email it rides beside, cut down to a lock-screen line — the subject as the
// title, the inbox preview as the body, the email's button as where a tap lands.
// That is the whole blackout argument: no push says anything its email did not
// already say, and every email is guarded where it is built (ANTE-TECH §3.3, §7).
//
// Free, keyless to the push services, and off until both VAPID keys are set. With
// them unset (local, CI, the torture harness) this returns before touching the
// database, so a send path that pushes costs nothing where push cannot work.

export interface PushMessage {
  title: string;
  body: string;
  /** Same-origin path a tap opens. */
  url: string;
}

/** Receipts for something the player just did on screen. A push for those is noise. */
const NOT_PUSHED = ["player.ticket", "player.application_received"];

const SITE = "https://theantegame.com";

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/** "ANTE: Week 9 Is Open" → "Week 9 Is Open". The notification already wears the
 *  app's name and icon; the prefix would only spend the line twice. */
export function pushTitle(subject: string): string {
  return subject.replace(/^ANTE:\s*/, "").trim() || "ANTE";
}

/** An email link → a path on this site. Anything off-site lands on the dashboard. */
export function pushPath(href: string | undefined): string {
  if (!href) return "/dashboard";
  if (href.startsWith("/")) return href;
  if (href === SITE || href === `${SITE}/`) return "/dashboard";
  if (href.startsWith(`${SITE}/`)) return href.slice(SITE.length);
  return "/dashboard";
}

/** Lock screens show two or three lines; the rest is cut by the phone anyway. */
export function pushBody(text: string): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > 180 ? `${one.slice(0, 177).trimEnd()}…` : one;
}

/** The push for a designed email. The tap target is the doc's LAST button: a poll
 *  email's first buttons are one-tap votes (D-095), and a notification tap must
 *  never cast one. */
export function pushFromDoc(subject: string, doc: EmailDoc): PushMessage {
  const ctas = doc.blocks.filter((b) => b.kind === "cta");
  const last = ctas[ctas.length - 1];
  return {
    title: pushTitle(subject),
    body: pushBody(doc.preheader || doc.headline),
    url: pushPath(last && last.kind === "cta" ? last.href : undefined),
  };
}

/** When a push may reach a phone (D-121). Quiet hours always apply; these add to them. */
export interface PushTiming {
  /** Hold a morning push until this hour, league time (the week-open push: 10). */
  notBeforeHour?: number;
  /** A reminder: if the player has a ticket in this week by the time the push is
   *  due, it is not sent. Only matters for a push that was held. */
  unlessTicketFor?: string;
}

export async function pushPlayer(
  db: SupabaseClient,
  playerId: string,
  templateKey: string,
  logKey: string,
  message: PushMessage,
  dedupe: boolean,
  timing?: PushTiming,
): Promise<void> {
  if (!pushConfigured()) return;
  if (NOT_PUSHED.some((k) => templateKey.startsWith(k))) return;

  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("player_id", playerId);
  if (!subs || subs.length === 0) return;

  if (dedupe) {
    const { data: existing } = await db
      .from("notification_log")
      .select("id")
      .eq("player_id", playerId)
      .eq("channel", "push")
      .eq("template_key", logKey)
      .in("status", ["sent", "held"])
      .limit(1);
    if (existing && existing.length > 0) return;
  }

  // Quiet hours (D-121): the push waits in push_queue and the push.release job sends
  // it in the morning. The log row is written now, as "held", so the dedupe above
  // sees it and a re-run cannot queue it twice.
  const releaseAt = pushReleaseAt(DateTime.now(), timing?.notBeforeHour);
  if (releaseAt) {
    const { data: log } = await db
      .from("notification_log")
      .insert({
        player_id: playerId,
        channel: "push",
        template_key: logKey,
        body: `${message.title} — ${message.body}`,
        status: "held",
      })
      .select("id")
      .single();
    await db.from("push_queue").insert({
      player_id: playerId,
      log_id: log?.id ?? null,
      log_key: logKey,
      title: message.title,
      body: message.body,
      url: message.url,
      deliver_after: releaseAt.toISOString(),
      unless_ticket_week: timing?.unlessTicketFor ?? null,
    });
    return;
  }

  const result = await deliver(db, subs, message);
  await db.from("notification_log").insert({
    player_id: playerId,
    channel: "push",
    template_key: logKey,
    body: `${message.title} — ${message.body}`,
    status: result.sent > 0 ? "sent" : "failed",
    error: result.errors.length > 0 ? result.errors.join("; ").slice(0, 500) : null,
  });
}

/** One player's devices. A 404 or 410 means the push service has forgotten that
 *  install (app removed, permission revoked), so the row goes with it. */
export async function deliver(
  db: SupabaseClient,
  subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  message: PushMessage,
): Promise<{ sent: number; errors: string[] }> {
  const vapidDetails = {
    subject: SITE,
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    privateKey: process.env.VAPID_PRIVATE_KEY!,
  };
  const payload = JSON.stringify(message);
  const ok: string[] = [];
  const errors: string[] = [];
  const gone: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        // TTL: a reminder that arrives a day late is wrong, not late. High urgency
        // asks Android's battery saver not to sit on it.
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          vapidDetails,
          TTL: 6 * 60 * 60,
          urgency: "high",
        });
        ok.push(s.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.id);
        else errors.push(status ? `HTTP ${status}` : e instanceof Error ? e.message : String(e));
      }
    }),
  );

  if (gone.length > 0) await db.from("push_subscriptions").delete().in("id", gone);
  if (ok.length > 0) await db.from("push_subscriptions").update({ last_seen_at: new Date().toISOString() }).in("id", ok);
  if (ok.length === 0 && errors.length === 0) errors.push("every device had unsubscribed; removed");
  return { sent: ok.length, errors };
}
