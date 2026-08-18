import { makeJobRoute } from "@/lib/jobs/route";
import { slateOpen } from "@/lib/jobs/slateOpen";

export const dynamic = "force-dynamic";
export const GET = makeJobRoute("slate.open", slateOpen);
