import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/db/json";
import { fetchAllRows } from "@/lib/db/fetchAll";
import type { EngineLedgerEntry, SideAccount } from "@/lib/engine/types";

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

/** Current stacks — SUM over the append-only ledger. Nothing reads a stack column,
 *  because there isn't one (ANTE-TECH §1). Paged: the ledger outgrows PostgREST's
 *  1,000-row cap mid-season at 25 players — the torture test caught this.
 *
 *  `asOfWeek` scopes the sum to weeks at or before that number, plus season-level rows
 *  that carry no week (the buy-in). Settling forward never needs it — later weeks do
 *  not exist yet — but a RE-SETTLEMENT does: replaying week 5 must see the stacks and
 *  the Pot as week 5 saw them, not as they stand after weeks 6–8 have already settled.
 *  Without it a correction awards a Pot swollen by later antes and pays players their
 *  later balances (D-023). */
export async function stacksByPlayer(db: SupabaseClient, asOfWeek?: number): Promise<Map<string, number>> {
  let weekIds: string[] | null = null;
  if (asOfWeek !== undefined) {
    const { data } = await db.from("weeks").select("id").lte("number", asOfWeek);
    weekIds = (data ?? []).map((w) => w.id);
  }
  const rows = await fetchAllRows<{ player_id: string | null; account: string | null; amount: number }>((from, to) => {
    const q = db.from("ledger_entries").select("player_id, account, amount");
    // `or` keeps the season-level buy-in rows, which carry no week_id at all.
    return (weekIds === null ? q : q.or(`week_id.is.null,week_id.in.(${weekIds.join(",")})`))
      .order("id")
      .range(from, to);
  });
  const stacks = new Map<string, number>();
  let pot = 0;
  for (const e of rows) {
    // A side-game account (D-132) is neither a player nor the Pot. Counting its rows
    // as Pot would hand side-game chips to the weekly Pot winner — the D-023 leak.
    if (e.account !== null) continue;
    if (e.player_id === null) pot += e.amount;
    else stacks.set(e.player_id, (stacks.get(e.player_id) ?? 0) + e.amount);
  }
  stacks.set("__pot__", pot);
  return stacks;
}

/** Side-game account balances (D-132): the house and each game's pool. */
export async function sideAccountBalances(db: SupabaseClient): Promise<Record<SideAccount, number>> {
  const rows = await fetchAllRows<{ account: string; amount: number }>((from, to) =>
    db.from("ledger_entries").select("account, amount").not("account", "is", null).order("id").range(from, to),
  );
  const out: Record<SideAccount, number> = { play_house: 0, play_pool_bingo: 0, play_pool_crunch: 0 };
  for (const r of rows) {
    if (!(r.account in out)) throw new Error(`unknown side-game account ${r.account}`);
    out[r.account as SideAccount] += Number(r.amount);
  }
  return out;
}

/** The full ledger in engine shape — what assertInvariants eats. Paged. */
export async function fullLedgerForEngine(db: SupabaseClient): Promise<EngineLedgerEntry[]> {
  const rows = await fetchAllRows<{ player_id: string | null; account: string | null; kind: string; amount: number; reason: string }>(
    (from, to) => db.from("ledger_entries").select("player_id, account, kind, amount, reason").order("id").range(from, to),
  );
  return rows.map((e) => ({
    account: e.player_id,
    side: (e.account as SideAccount | null) ?? null,
    kind: e.kind as EngineLedgerEntry["kind"],
    amount: Number(e.amount),
    reason: e.reason,
  }));
}
