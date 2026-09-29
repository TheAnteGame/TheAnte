import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { emailPlayer, mailSubject } from "@/lib/notify/templates";
import { LEAGUE_TZ } from "@/lib/time";

// Tells the commissioner, by email, that a job which moves chips has stopped (D-110).
//
// On 2026-09-29 Week 3's settlement failed at 9:15pm MST and the only record was a
// job_runs row nobody reads. The board spent the next morning ranking the league on
// half-settled stacks. A failure that halts settlement is loud by design (§8.12) —
// loud has to mean someone is told, not that a row was written.
//
// At most one email per problem per league day: the jobs that call this retry every
// five minutes, and a stuck settlement should not become 288 emails. A mail failure
// is swallowed — an alert must never turn a failed job into a crashed one.

export type AlertKind = "settlement_failed" | "week_blocked";

export async function alertCommissioner(
  db: SupabaseClient,
  kind: AlertKind,
  weekNumber: number,
  detail: string,
  opts?: { test?: boolean },
): Promise<boolean> {
  try {
    const { data: seat } = await db.from("commissioner").select("player_id").maybeSingle();
    if (!seat?.player_id) return false;
    const { data: commish } = await db.from("players").select("id, email").eq("id", seat.player_id).maybeSingle();
    if (!commish?.email) return false;

    const today = DateTime.now().setZone(LEAGUE_TZ).toFormat("yyyy-LL-dd");
    const subject = await mailSubject(db, `mail.${kind}.subject`, { week: weekNumber });
    // A test (the console's "Send test alert") goes through the identical template,
    // transport and log, marked in the subject, and is never deduped away.
    const dedupe = opts?.test ? `alert-test-${kind}-${Date.now()}` : `alert-${kind}-w${weekNumber}-${today}`;
    await emailPlayer(
      db,
      commish,
      `notify.${kind}`,
      opts?.test ? `[TEST] ${subject}` : subject,
      { week: weekNumber, detail },
      dedupe,
      { allowFreeText: true },
    );
    const { data: logged } = await db
      .from("notification_log")
      .select("status")
      .eq("template_key", dedupe)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return logged?.status === "sent" || logged?.status === "queued";
  } catch (e) {
    console.error(`commissioner alert (${kind}, week ${weekNumber}) failed:`, e);
    return false;
  }
}
