import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobOutcome } from "./util";
import { emailDoc } from "@/lib/notify/templates";
import { templateDoc } from "@/lib/notify/docs";

// One-off league emails (D-088). A broadcast row is the commissioner's message;
// sending it means one emailDoc per approved player with an email, deduped in
// notification_log under broadcast:<id> — so a job that runs twice, or a "send now"
// that races the cron, cannot mail anybody twice. The row is marked sent with the
// count once every recipient has been attempted.

export interface BroadcastRow {
  id: string;
  subject: string;
  headline: string;
  eyebrow: string;
  body: string;
  cta_label: string | null;
  cta_href: string | null;
}

export function broadcastDoc(b: BroadcastRow) {
  return templateDoc({
    eyebrow: b.eyebrow || "ANTE",
    headline: b.headline,
    body: b.body,
    cta: b.cta_label && b.cta_href ? { label: b.cta_label, href: b.cta_href } : undefined,
  });
}

/** Send one broadcast to the league. Returns the number of players attempted. */
export async function sendBroadcast(db: SupabaseClient, b: BroadcastRow): Promise<number> {
  const { data: players } = await db.from("players").select("id, email").eq("status", "approved");
  const doc = broadcastDoc(b);
  let n = 0;
  for (const p of players ?? []) {
    if (!p.email) continue;
    await emailDoc(db, { id: p.id, email: p.email }, "broadcast", b.subject, doc, `broadcast:${b.id}`);
    n++;
  }
  await db
    .from("broadcasts")
    .update({ status: "sent", sent_count: n, sent_at: new Date().toISOString() })
    .eq("id", b.id);
  return n;
}

/** The cron: everything queued whose time has come. */
export async function sendDueBroadcasts(db: SupabaseClient): Promise<JobOutcome> {
  const { data: due, error } = await db
    .from("broadcasts")
    .select("id, subject, headline, eyebrow, body, cta_label, cta_href")
    .eq("status", "queued")
    .lte("send_at", new Date().toISOString())
    .order("send_at");
  if (error) return { status: "failed", detail: error.message };
  if (!due || due.length === 0) return { status: "skipped", detail: "nothing due" };
  const sent: Record<string, number> = {};
  for (const b of due) {
    try {
      sent[b.id] = await sendBroadcast(db, b);
    } catch (e) {
      await db
        .from("broadcasts")
        .update({ status: "failed", error: e instanceof Error ? e.message : String(e) })
        .eq("id", b.id);
    }
  }
  return { status: "succeeded", detail: sent };
}
