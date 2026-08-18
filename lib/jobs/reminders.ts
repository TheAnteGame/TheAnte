import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { ET } from "@/lib/time";
import { emailPlayer } from "@/lib/notify/templates";
import type { JobOutcome } from "./util";

// Reminder (Wed 6pm ET) and final call (Thu 9am ET), unsubmitted players only
// (ADMIN §4.7). The cron fires on both possible UTC hours; the ET guard picks the
// right one, and the notification_log dedupe makes repeats harmless.

export async function reminders(db: SupabaseClient): Promise<JobOutcome> {
  const { data: week } = await db
    .from("weeks")
    .select("id, number, deadline_at, phase")
    .eq("phase", "open")
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!week) return { status: "skipped", detail: { reason: "no open week" } };

  const now = DateTime.now().setZone(ET);
  let templateKey: string;
  let subject: string;
  let vars: Record<string, string | number>;

  if (now.weekday === 3 && now.hour >= 18) {
    const hoursLeft = Math.max(1, Math.round(DateTime.fromISO(week.deadline_at).diff(now, "hours").hours));
    templateKey = "notify.reminder";
    subject = `ANTE — Week ${week.number}: the room can see your name`;
    vars = { week: week.number, hours_left: hoursLeft };
  } else if (now.weekday === 4 && now.hour >= 9 && now.hour < 12) {
    templateKey = "notify.final_call";
    subject = `ANTE — final call for Week ${week.number}`;
    vars = { week: week.number };
  } else {
    return { status: "skipped", detail: { reason: "outside reminder windows (ET)" } };
  }

  const [{ data: active }, { data: tickets }] = await Promise.all([
    db.from("players").select("id, email").eq("status", "approved"),
    db.from("tickets").select("player_id").eq("week_id", week.id),
  ]);
  const submitted = new Set((tickets ?? []).map((t) => t.player_id));
  const unsubmitted = (active ?? []).filter((p) => !submitted.has(p.id));

  for (const p of unsubmitted) {
    await emailPlayer(db, p, templateKey, subject, vars, `${templateKey}:w${week.number}`);
  }

  return { status: "succeeded", detail: { template: templateKey, recipients: unsubmitted.length } };
}
