import { makeJobRoute } from "@/lib/jobs/route";
import { revealDeadline } from "@/lib/jobs/reveal";

export const dynamic = "force-dynamic";
export const GET = makeJobRoute("reveal.deadline", revealDeadline);
