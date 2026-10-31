import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { deliver, pushConfigured } from "@/lib/notify/push";
import { pushReleaseAt } from "@/lib/notify/quiet";
import type { JobOutcome } from "./util";

// push.release (D-121): sends the phone notifications quiet hours held back. Runs
// every five minutes; outside quiet hours it sends whatever has come due, inside
// them it does nothing.
//
// Two things a morning send must not do. A reminder must not reach someone who has
// since put a ticket in — that is the whole point of the Tuesday and Thursday
// holds — so those rows carry the week and are dropped once a ticket exists. And a
// night of Table Talk must not land as a stack of mentions at 9am: each player gets
// the latest one, and the rest are marked superseded.

/** A held push this old missed its moment (a job outage); sending it now is wrong. */
const STALE_HOURS = 6;

interface Held {
  id: string;
  player_id: string;
  log_id: string | null;
  log_key: string;
  title: string;
  body: string;
  url: string;
  deliver_after: string;
  unless_ticket_week: string | null;
}

export async function pushRelease(db: SupabaseClient): Promise<JobOutcome> {
  if (!pushConfigured()) return { status: "skipped", detail: { reason: "push is not configured" } };
  if (pushReleaseAt(DateTime.now())) return { status: "skipped", detail: { reason: "quiet hours" } };

  const now = new Date();
  const { data, error } = await db
    .from("push_queue")
    .select("id, player_id, log_id, log_key, title, body, url, deliver_after, unless_ticket_week")
    .lte("deliver_after", now.toISOString())
    .order("created_at");
  if (error) throw new Error(`push queue read failed: ${error.message}`);
  const held = (data ?? []) as Held[];
  if (held.length === 0) return { status: "skipped", detail: { reason: "nothing held" } };

  const latestMention = new Map<string, string>();
  for (const h of held) if (h.log_key.startsWith("mention-")) latestMention.set(h.player_id, h.id);

  const counts = { sent: 0, failed: 0, skipped: 0 };
  for (const h of held) {
    // Claim the row before sending, so two overlapping runs cannot both send it.
    const { data: claimed } = await db.from("push_queue").delete().eq("id", h.id).select("id");
    if (!claimed || claimed.length === 0) continue;

    let status: string | null = null;
    let err: string | null = null;

    if (now.getTime() - new Date(h.deliver_after).getTime() > STALE_HOURS * 3600_000) {
      err = "held too long; not sent late";
    } else if (h.log_key.startsWith("mention-") && latestMention.get(h.player_id) !== h.id) {
      err = "a later mention went instead";
    } else if (h.unless_ticket_week) {
      const { data: ticket } = await db
        .from("tickets")
        .select("id")
        .eq("player_id", h.player_id)
        .eq("week_id", h.unless_ticket_week)
        .limit(1);
      if (ticket && ticket.length > 0) err = "ticket already in";
    }

    if (err) {
      status = "skipped";
      counts.skipped++;
    } else {
      const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("player_id", h.player_id);
      if (!subs || subs.length === 0) {
        status = "failed";
        err = "no devices left";
      } else {
        const result = await deliver(db, subs, { title: h.title, body: h.body, url: h.url });
        status = result.sent > 0 ? "sent" : "failed";
        err = result.errors.length > 0 ? result.errors.join("; ").slice(0, 500) : null;
      }
      counts[status === "sent" ? "sent" : "failed"]++;
    }

    if (h.log_id) await db.from("notification_log").update({ status, error: err, sent_at: new Date().toISOString() }).eq("id", h.log_id);
  }

  return { status: "succeeded", detail: counts };
}
