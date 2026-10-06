import type { SupabaseClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import type { JobOutcome } from "./util";
import { emailDoc } from "@/lib/notify/templates";
import { pollEmail, pollResultEmail } from "@/lib/notify/docs";
import { outcomeOf, tally } from "@/lib/polls/tally";
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

/** The result, to every approved player, once (D-111). Counts and percentages only —
 *  the votes are read as option indexes and nothing else, so no name can reach the
 *  email even by accident. Deduped per player per poll in notification_log, so the
 *  automatic close, an early close from the console, and a re-send are all safe to
 *  repeat: a player who already has it is skipped. */
export async function mailPollResults(db: SupabaseClient, poll: Pick<PollRow, "id" | "question" | "options">): Promise<number> {
  const { data: votes, error } = await db.from("poll_votes").select("option_index").eq("poll_id", poll.id);
  if (error) throw new Error(`poll votes read failed: ${error.message}`);
  const t = tally(votes ?? [], poll.options.length);
  const outcome = outcomeOf(poll.options, t);
  const rows = poll.options.map((label, i) => ({ label, votes: t.counts[i], percent: t.percents[i] }));

  const { data: players } = await db.from("players").select("id, email, first_name").eq("status", "approved");
  const eligible = (players ?? []).length;
  let n = 0;
  for (const p of players ?? []) {
    if (!p.email) continue;
    const doc = pollResultEmail({ firstName: p.first_name ?? "Hey", question: poll.question, rows, total: t.total, eligible, outcome });
    await emailDoc(db, { id: p.id, email: p.email }, "poll.result", `ANTE: Poll Results — ${poll.question}`, doc, `poll.result:${poll.id}`);
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
      // Mail first, then mark closed: if the send dies part-way, the next tick finds
      // the poll still unclosed and finishes the job, and the per-player dedupe
      // keeps anyone from getting it twice.
      const n = await mailPollResults(db, poll);
      await db.from("polls").update({ closed_at: nowIso }).eq("id", poll.id);
      detail[poll.id] = `closed, results mailed ${n}`;
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
