import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { LEAGUE_TZ } from "@/lib/time";
import { emailPlayer, mailSubject } from "@/lib/notify/templates";
import { pushPlayer } from "@/lib/notify/push";
import type { JobOutcome } from "./util";

// Reminder (Wed noon MST, 24h to the wall) and final call (Thu 6am MST), unsubmitted
// players only (D-092). Phones keep their own clock (D-121): the final call's push
// is held by quiet hours until 9am, and an 11am "one hour left" goes to phones only —
// the emails are unchanged
// (ADMIN §4.7). The cron fires on both possible UTC hours; the MST guard picks the
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

  const now = DateTime.now().setZone(LEAGUE_TZ);
  let templateKey: string;
  let subject: string;
  let vars: Record<string, string | number>;
  // The envelope's eyebrow and headline (D-068). Without these the HTML part fell
  // back to the subject, which put "ANTE" as an eyebrow directly under the ANTE
  // logo and then repeated the subject as the headline. The designed five all name
  // the moment instead ("Application received", "Welcome to the league").
  let look: { eyebrow: string; headline: string };

  if (now.weekday === 3 && now.hour >= 12) {
    const hoursLeft = Math.max(1, Math.round(DateTime.fromISO(week.deadline_at).diff(now, "hours").hours));
    templateKey = "notify.reminder";
    subject = await mailSubject(db, "mail.reminder.subject", { week: week.number });
    vars = { week: week.number, hours_left: hoursLeft };
    look = { eyebrow: `Week ${week.number} reminder`, headline: "You're not in yet" };
  } else if (now.weekday === 4 && now.hour === 11) {
    return lastHour(db, week);
  } else if (now.weekday === 4 && now.hour >= 6 && now.hour < 11) {
    templateKey = "notify.final_call";
    subject = await mailSubject(db, "mail.final_call.subject", { week: week.number });
    vars = { week: week.number };
    look = { eyebrow: `Week ${week.number} final call`, headline: "Noon is the wall" };
  } else {
    return { status: "skipped", detail: { reason: "outside reminder windows (MST)" } };
  }

  const unsubmitted = await unsubmittedPlayers(db, week.id);

  for (const p of unsubmitted) {
    await emailPlayer(db, p, templateKey, subject, vars, `${templateKey}:w${week.number}`, {
      ...look,
      cta: { label: "Put your ticket in", href: "https://theantegame.com/dashboard" },
      push: { unlessTicketFor: week.id },
    });
  }

  return { status: "succeeded", detail: { template: templateKey, recipients: unsubmitted.length } };
}

async function unsubmittedPlayers(db: SupabaseClient, weekId: string) {
  const [{ data: active }, { data: tickets }] = await Promise.all([
    db.from("players").select("id, email").eq("status", "approved"),
    db.from("tickets").select("player_id").eq("week_id", weekId),
  ]);
  const submitted = new Set((tickets ?? []).map((t) => t.player_id));
  return (active ?? []).filter((p) => !submitted.has(p.id));
}

/** Thursday 11am, an hour to the wall (D-121): a phone notification and nothing
 *  else — the owner asked for one more buzz, not one more email. */
async function lastHour(db: SupabaseClient, week: { id: string; number: number }): Promise<JobOutcome> {
  const [title, body] = await Promise.all([
    mailSubject(db, "push.last_hour.title", { week: week.number }),
    mailSubject(db, "push.last_hour.body", { week: week.number }),
  ]);
  const players = await unsubmittedPlayers(db, week.id);
  for (const p of players) {
    await pushPlayer(db, p.id, "push.last_hour", `push.last_hour:w${week.number}`, { title, body, url: "/dashboard" }, true);
  }
  return { status: "succeeded", detail: { template: "push.last_hour", recipients: players.length } };
}
