import { makeJobRoute } from "@/lib/jobs/route";
import { revealCheck } from "@/lib/jobs/reveal";

export const dynamic = "force-dynamic";
export const GET = makeJobRoute("reveal.check", revealCheck);
