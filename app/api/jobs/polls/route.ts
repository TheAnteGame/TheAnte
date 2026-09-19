import { makeJobRoute } from "@/lib/jobs/route";
import { pollsTick } from "@/lib/jobs/polls";

export const dynamic = "force-dynamic";
export const GET = makeJobRoute("polls.tick", pollsTick);
