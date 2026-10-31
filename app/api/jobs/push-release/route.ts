import { makeJobRoute } from "@/lib/jobs/route";
import { pushRelease } from "@/lib/jobs/pushRelease";

export const dynamic = "force-dynamic";
export const GET = makeJobRoute("push.release", pushRelease);
