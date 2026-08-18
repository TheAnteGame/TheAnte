import { makeJobRoute } from "@/lib/jobs/route";
import { scoresSync } from "@/lib/jobs/scoresSync";

export const dynamic = "force-dynamic";
export const GET = makeJobRoute("scores.sync", scoresSync);
