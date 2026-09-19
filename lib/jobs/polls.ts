import type { SupabaseClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import type { JobOutcome } from "./util";
import { emailDoc } from "@/lib/notify/templates";
import { pollEmail } from "@/lib/notify/docs";
import { voteLink } from "@/lib/polls/links";
import { LEAGUE_TZ } from "@/lib/time";

// League polls, the clockwork (D-095): every five minutes, mail the league for any
// poll that has just opened, mail again for any poll six hours from closing, and
// mark closed anything past its close. Each mail is deduped per player per poll in
// notification_log, so a double-fire cannot double-mail.

export interface PollRow {
  id: string;
  question: string;
  options: string[];
  opens_at: string;
  closes_at: string;
  opened_notified_at: string | null;
  reminder_notified_at: string | null;
  closed_at: string | null;
}

const REMIND_HOURS = 6;

async function mailPoll(db: SupabaseClient, poll: PollRow, kind: "open" | "reminder"): Promise<number> {
  const { data: players } = await db.from("players").select("id, email, first_name").eq("status", "approved");
  const closes = DateTime.fromISO(poll.closes_at).setZone(LEAGUE_TZ).toFormat("cccc h:mma 'MST'");
  let n = 0;
  for (const p of players ?? []) {
    if (!p.email) continue;
    const doc = pollEmail({
      kind,
      firstName: p.first_name ?? "Hey",
      question: poll.question,
      options: poll.options.map((label, i) => ({ label, href: voteLink(poll.id, p.id, i) })),
      closes,
    });
    const subject = kind === "open" ? `ANTE: League Poll — ${poll.question}` : `ANTE: Poll Closes Soon — ${poll.question}`;
    await emailDoc(db, { id: p.id, email: p.email }, `poll.${kind}`, subject, doc, `poll:${poll.id}:${kind}`);
    n++;
  }
  return n;
}

export async function pollsTick(db: SupabaseClient): Promise<JobOutcome> {
  const now = new Date();
  const nowIso = now.toISOString();
  const { data: polls, error } = await db
    .from("polls")
    .select("id, question, options, opens_at, closes_at, opened_notified_at, reminder_notified_at, closed_at")
    .is("closed_at", null)
    .lte("opens_at", nowIso);
  if (error) return { status: "failed", detail: error.message };
  if (!polls || polls.length === 0) return { status: "skipped", detail: "no live polls" };

  const detail: Record<string, string> = {};
  for (const poll of polls as PollRow[]) {
    const closes = new Date(poll.closes_at);
    if (closes <= now) {
      await db.from("polls").update({ closed_at: nowIso }).eq("id", poll.id);
      detail[poll.id] = "closed";
      continue;
    }
    if (!poll.opened_notified_at) {
      const n = await mailPoll(db, poll, "open");
      await db.from("polls").update({ opened_notified_at: nowIso }).eq("id", poll.id);
      detail[poll.id] = `opened, mailed ${n}`;
      continue;
    }
    const remindAt = new Date(closes.getTime() - REMIND_HOURS * 3600_000);
    if (!poll.reminder_notified_at && remindAt <= now) {
      const n = await mailPoll(db, poll, "reminder");
      await db.from("polls").update({ reminder_notified_at: nowIso }).eq("id", poll.id);
      detail[poll.id] = `reminded ${n}`;
    }
  }
  return Object.keys(detail).length ? { status: "succeeded", detail } : { status: "skipped", detail: "nothing due" };
}
