import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── The RLS boundary (ANTE-TECH §4.2) ────────────────────────────────────────────
// Runtime reads go through RLS *as the requesting user*, carrying the Clerk session
// token via Clerk's native third-party integration with Supabase. The user identifier
// that reaches Postgres is auth.jwt()->>'sub' — a Clerk user id, text, NOT auth.uid().
// This client is what makes the blackout real: pre-reveal ticket rows simply do not
// come back, for anyone, commissioner included.

export function createUserClient(): SupabaseClient {
  return createClient(url, anonKey, {
    accessToken: async () => {
      const { getToken } = await auth();
      return (await getToken()) ?? null;
    },
  });
}

// Anonymous server client — public-readable tables only (content_blocks, teams).
export function createAnonServerClient(): SupabaseClient {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

// ── Service role (ANTE-TECH §4.3) ────────────────────────────────────────────────
// Permitted ONLY inside server actions and cron jobs that have already passed a
// commissioner or system check: settlement writes, cron jobs, admin corrections.
// Ticket reads are NOT on that list — acceptance test 1 exists to catch it. Note the
// database still defends itself against this client: the ticket-immutability trigger
// and the append-only triggers raise for the service role too.
export function createServiceClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
