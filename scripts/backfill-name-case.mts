/**
 * BACKFILL: TITLE-CASE EVERY PLAYER NAME
 *
 * Some players typed their name in lowercase during onboarding (or a commissioner
 * edit predated the titleCase() normalization added alongside this script). Names
 * are display-only — never read by lib/engine/ — so this is a plain data fix, not
 * a chip-conservation change; the season torture test does not apply.
 *
 * Dry run by default: prints every row that would change, writes nothing.
 *
 *   npm run backfill:name-case                # dry run against NEXT_PUBLIC_SUPABASE_URL
 *   npm run backfill:name-case -- --local     # dry run against the local stack
 *   npm run backfill:name-case -- --confirm   # actually write
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { titleCase } from "@/lib/name";

function loadEnvLocal(): Record<string, string> {
  const f = path.join(process.cwd(), ".env.local");
  if (!existsSync(f)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const useLocal = process.argv.includes("--local");
const confirm = process.argv.includes("--confirm");
const env = { ...loadEnvLocal(), ...process.env };
const URL_ = useLocal ? "http://127.0.0.1:54321" : (env.NEXT_PUBLIC_SUPABASE_URL ?? "");
const KEY = useLocal
  ? (process.env.LOCAL_SERVICE_KEY ?? "")
  : (env.SUPABASE_SERVICE_ROLE_KEY ?? "");

if (!URL_ || !KEY) {
  console.error("backfill-name-case: no target. Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or --local).");
  process.exit(2);
}

const db = createClient(URL_, KEY, { auth: { persistSession: false } });

const { data: players, error } = await db.from("players").select("id, first_name, last_name");
if (error) {
  console.error("backfill-name-case: fetch failed —", error.message);
  process.exit(1);
}

type Change = { id: string; field: "first_name" | "last_name"; before: string; after: string };
const changes: Change[] = [];
for (const p of players ?? []) {
  for (const field of ["first_name", "last_name"] as const) {
    const before = p[field] as string | null;
    if (!before) continue;
    const after = titleCase(before);
    if (after !== before) changes.push({ id: p.id, field, before, after });
  }
}

if (changes.length === 0) {
  console.log("backfill-name-case: every name is already Title Case. Nothing to do.");
  process.exit(0);
}

console.log(`backfill-name-case: ${changes.length} field(s) to fix${confirm ? "" : " (dry run — pass --confirm to write)"}:`);
for (const c of changes) console.log(`  ${c.id}  ${c.field}: "${c.before}" -> "${c.after}"`);

if (!confirm) process.exit(0);

for (const c of changes) {
  const { error: updateErr } = await db.from("players").update({ [c.field]: c.after }).eq("id", c.id);
  if (updateErr) {
    console.error(`backfill-name-case: failed to update ${c.id}.${c.field} —`, updateErr.message);
    process.exit(1);
  }
}
console.log(`backfill-name-case: wrote ${changes.length} field(s).`);
