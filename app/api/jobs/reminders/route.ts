import { makeJobRoute } from "@/lib/jobs/route";
import { reminders } from "@/lib/jobs/reminders";

export const dynamic = "force-dynamic";
export const GET = makeJobRoute("notify.reminders", reminders);
