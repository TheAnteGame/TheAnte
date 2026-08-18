import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAuthorizedCron, runJob, type JobOutcome } from "./util";

/** Shared handler factory for /api/jobs/*. Auth first, job_runs always. */
export function makeJobRoute(jobKey: string, fn: (db: SupabaseClient) => Promise<JobOutcome>) {
  return async function GET(req: Request) {
    if (!isAuthorizedCron(req)) return new NextResponse(null, { status: 401 });
    const outcome = await runJob(jobKey, fn);
    return NextResponse.json(outcome, { status: outcome.status === "failed" ? 500 : 200 });
  };
}
