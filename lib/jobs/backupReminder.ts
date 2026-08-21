import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { emailPlayer } from "@/lib/notify/templates";
import { contentDefaults } from "@/lib/content/defaults";
import { ET } from "@/lib/time";
import type { JobOutcome } from "./util";

// backup.reminder (D-017). The org is on Supabase's free plan — no automated
// backups — so the downloaded file is the only copy that survives losing the
// project, and a copy nobody remembers to take is not a backup.
//
// This nags the commissioner once a day, every day, from the moment a download is
// overdue until they press "I've got the file" on the backups page. Silence means
// the backup is current, not that the job is broken.

const SETTING_LAST = "backup.last_confirmed_at";
const SETTING_EVERY = "backup.remind_after_days";
const DEFAULT_DAYS = 7;

export async function backupReminder(db: SupabaseClient): Promise<JobOutcome> {
  const { data: rows } = await db.from("app_settings").select("key, value").in("key", [SETTING_LAST, SETTING_EVERY]);
  const settings = new Map((rows ?? []).map((r) => [r.key, r.value]));

  const everyDays = typeof settings.get(SETTING_EVERY) === "number" ? (settings.get(SETTING_EVERY) as number) : DEFAULT_DAYS;
  const lastRaw = settings.get(SETTING_LAST);
  const last = typeof lastRaw === "string" ? DateTime.fromISO(lastRaw) : null;
  const daysSince = last ? Math.floor(DateTime.now().diff(last, "days").days) : null;

  if (daysSince !== null && daysSince < everyDays) {
    return { status: "skipped", detail: { reason: "backup is current", daysSince, everyDays } };
  }

  const { data: seat } = await db.from("commissioner").select("player_id").maybeSingle();
  if (!seat?.player_id) return { status: "skipped", detail: { reason: "no commissioner seated" } };

  const { data: commish } = await db.from("players").select("id, email").eq("id", seat.player_id).maybeSingle();
  if (!commish?.email) return { status: "skipped", detail: { reason: "commissioner has no email" } };

  // One send per calendar day in ET, however many times the cron fires.
  const today = DateTime.now().setZone(ET).toFormat("yyyy-LL-dd");
  await emailPlayer(
    db,
    commish,
    "notify.backup_reminder",
    contentDefaults["notify.backup_reminder_subject"],
    { days: daysSince === null ? "never" : String(daysSince) },
    `backup-reminder-${today}`,
  );

  return { status: "succeeded", detail: { emailed: true, daysSince, everyDays } };
}
