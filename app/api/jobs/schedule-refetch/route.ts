import { makeJobRoute } from "@/lib/jobs/route";
import { scheduleRefetch } from "@/lib/jobs/scheduleRefetch";

export const dynamic = "force-dynamic";
export const GET = makeJobRoute("schedule.refetch", scheduleRefetch);
