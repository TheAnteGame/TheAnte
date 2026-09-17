import { makeJobRoute } from "@/lib/jobs/route";
import { sendDueBroadcasts } from "@/lib/jobs/broadcast";

export const dynamic = "force-dynamic";
export const GET = makeJobRoute("broadcast.send", sendDueBroadcasts);
