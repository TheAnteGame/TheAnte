import { makeJobRoute } from "@/lib/jobs/route";
import { settleCurrentWeek } from "@/lib/jobs/settle";

export const dynamic = "force-dynamic";
export const GET = makeJobRoute("settle.week", settleCurrentWeek);
