import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/db/json";
import { fetchAllRows } from "@/lib/db/fetchAll";

// Jobs run with the service role — a permitted use (ANTE-TECH §4.3). The 0002
// triggers still bind this client: it cannot touch a locked ticket or edit the
// ledger, only append. Every job writes a job_runs row (ANTE-ADMIN §5).

export function serviceDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service env not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Every /api/jobs/* route rejects requests without the shared secret. */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export interface JobOutcome {
  status: "succeeded" | "failed" | "skipped";
  detail?: Json;
}

export async function runJob(jobKey: string, fn: (db: SupabaseClient) => Promise<JobOutcome>): Promise<JobOutcome> {
  const db = serviceDb();
  const { data: run } = await db
    .from("job_runs")
    .insert({ job_key: jobKey, status: "running" })
    .select("id")
    .single();

  let outcome: JobOutcome;
  try {
    outcome = await fn(db);
  } catch (e) {
    outcome = { status: "failed", detail: { error: e instanceof Error ? e.message : String(e) } };
  }

  if (run?.id) {
    await db
      .from("job_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: outcome.status === "skipped" ? "succeeded" : outcome.status,
        detail: { outcome: outcome.status, ...(typeof outcome.detail === "object" ? outcome.detail : {}) } as Json,
      })
      .eq("id", run.id);
  }
  return outcome;
}

export async function postSystemMessage(db: SupabaseClient, body: string): Promise<void> {
  await db.from("chat_messages").insert({ player_id: null, body, is_system: true });
}

/** Current stacks — SUM over the append-only ledger. Nothing reads a stack column,
 *  because there isn't one (ANTE-TECH §1). Paged: the ledger outgrows PostgREST's
 *  1,000-row cap mid-season at 25 players — the torture test caught this. */
export async function stacksByPlayer(db: SupabaseClient): Promise<Map<string, number>> {
  const rows = await fetchAllRows<{ player_id: string | null; amount: number }>((from, to) =>
    db.from("ledger_entries").select("player_id, amount").order("id").range(from, to),
  );
  const stacks = new Map<string, number>();
  let pot = 0;
  for (const e of rows) {
    if (e.player_id === null) pot += e.amount;
    else stacks.set(e.player_id, (stacks.get(e.player_id) ?? 0) + e.amount);
  }
  stacks.set("__pot__", pot);
  return stacks;
}
