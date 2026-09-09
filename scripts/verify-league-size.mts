/** Proves D-065 against a REAL local Supabase stack, reproducing production's exact
 *  situation: Week 1 opened with ONE approved player, then twelve more joined. */
import { execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const status = execSync("supabase status -o env", { encoding: "utf8" });
const env = Object.fromEntries(status.split("\n").map(l=>l.match(/^([A-Z_]+)="?([^"]*)"?$/)).filter((m):m is RegExpMatchArray=>!!m).map(m=>[m[1],m[2]]));
const API_URL = env.API_URL ?? "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_URL = API_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.ANON_KEY!;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SERVICE_ROLE_KEY!;
const db: SupabaseClient = createClient(API_URL, env.SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { admitToOpenWeek } = await import("../lib/jobs/admit");

execSync("supabase db reset", { stdio: "ignore" });

let fail = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(58)} got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};

const future = new Date(Date.now() + 36e5).toISOString();
const { data: season } = await db.from("seasons").insert({ year: 2026, status: "active", current_week: 1, week1_lock_at: null }).select("id").single();

async function addPlayer(n: number): Promise<string> {
  const { data } = await db.from("players").insert({
    clerk_user_id: `user_verify_${n}`, status: "approved", first_name: `P${n}`, last_name: "Test",
    favorite_team: "DEN", profile_complete: true, joined_at: new Date().toISOString(),
  }).select("id").single();
  await db.from("ledger_entries").insert({ player_id: data!.id, kind: "buy_in", amount: 500, reason: "Buy-in — verify", idempotency_key: "buy-in" });
  return data!.id;
}
const snap = async () => (await db.from("weeks").select("active_count_snapshot, places_tier_snapshot").eq("season_id", season!.id).single()).data;

// Week 1 opens with exactly one approved player — production's actual Aug 22 state.
const first = await addPlayer(1);
await db.from("weeks").insert({
  season_id: season!.id, number: 1, ante: 10, phase: "open",
  opens_at: new Date().toISOString(), deadline_at: future,
  median_snapshot: 500, places_tier_snapshot: 1, active_count_snapshot: 1, pot_before: 0,
});
await db.from("week_players").insert({ week_id: (await db.from("weeks").select("id").single()).data!.id, player_id: first, stack_pre_ante: 500, felt: false, house_limit: 160 });

console.log("\nA. Admission OPEN (week1_lock_at null) — roster grows 1 → 13");
check("starting snapshot", await snap(), { active_count_snapshot: 1, places_tier_snapshot: 1 });
for (let n = 2; n <= 13; n++) await admitToOpenWeek(db, await addPlayer(n));
check("after 12 late admissions", await snap(), { active_count_snapshot: 13, places_tier_snapshot: 1 });

console.log("\nB. Crossing a TIER boundary — the case that would have silently misplayed");
for (let n = 14; n <= 16; n++) await admitToOpenWeek(db, await addPlayer(n));
check("16 players now pays TWO places", await snap(), { active_count_snapshot: 16, places_tier_snapshot: 2 });

console.log("\nC. Falls as well as rises — a deactivation before the lock");
const { data: victim } = await db.from("players").select("id").eq("clerk_user_id", "user_verify_16").single();
await db.from("players").update({ status: "deactivated", deactivated_at: new Date().toISOString() }).eq("id", victim!.id);
const { syncLeagueSizeWhileAdmissionOpen } = await import("../lib/jobs/admit");
await syncLeagueSizeWhileAdmissionOpen(db);
check("15 players back to ONE place", await snap(), { active_count_snapshot: 15, places_tier_snapshot: 1 });

console.log("\nD. Roster LOCKED (§7 freeze) — must be a strict no-op");
await db.from("seasons").update({ week1_lock_at: new Date(Date.now() - 6e4).toISOString() }).eq("id", season!.id);
const before = await snap();
await admitToOpenWeek(db, await addPlayer(99));
check("snapshot frozen after the lock", await snap(), before);

console.log("\nE. Idempotent — a retried approval changes nothing");
await db.from("seasons").update({ week1_lock_at: null }).eq("id", season!.id);
await syncLeagueSizeWhileAdmissionOpen(db);
const once = await snap();
await syncLeagueSizeWhileAdmissionOpen(db);
check("second sync identical", await snap(), once);

console.log(fail === 0 ? "\n✅ D-065 VERIFIED — 6/6\n" : `\n❌ ${fail} FAILED\n`);
process.exit(fail === 0 ? 0 : 1);
