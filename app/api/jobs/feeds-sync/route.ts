import { makeJobRoute } from "@/lib/jobs/route";
import { feedsSync } from "@/lib/feeds";

export const dynamic = "force-dynamic";
export const GET = makeJobRoute("feeds.sync", feedsSync);
