import { makeJobRoute } from "@/lib/jobs/route";
import { backupReminder } from "@/lib/jobs/backupReminder";

export const dynamic = "force-dynamic";
export const GET = makeJobRoute("backup.reminder", backupReminder);
