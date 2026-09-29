/**
 * Schema drift check — does the deployed database actually have what the migrations
 * in this repo say it should?
 *
 * The bug this exists for: on 2026-08-26 the code for the deadweight rule (D-041)
 * shipped to production while migration 0019 had not been applied. Nothing in the
 * pipeline could see it. Vercel deploys code; migrations are applied by hand; and
 * the two had no check that they agreed. A feature sat live and inert, and the only
 * reason it was harmless is that the surface it powers was unreachable for weeks.
 *
 * How it works: parse every migration for the columns it declares (create table and
 * alter table ... add column), then ask the target database's PostgREST endpoint for
 * each one. A column PostgREST cannot select is a column that is not there.
 *
 *   npm run schema:check                  # against NEXT_PUBLIC_SUPABASE_URL in .env.local
 *   npm run schema:check -- --local       # against the local stack instead
 *
 * Exits non-zero on drift, so it can gate a deploy.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const MIGRATIONS = path.join(process.cwd(), "supabase", "migrations");

// ── Target ───────────────────────────────────────────────────────────────────────
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
const env = { ...loadEnvLocal(), ...process.env };
const URL_ = useLocal
  ? "http://127.0.0.1:54321"
  : (env.SCHEMA_CHECK_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "");
const KEY = useLocal
  ? (process.env.LOCAL_SERVICE_KEY ?? "")
  : (env.SCHEMA_CHECK_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? "");

if (!URL_ || !KEY) {
  console.error("schema-check: no target. Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or --local).");
  process.exit(2);
}

// ── What the migrations claim ────────────────────────────────────────────────────
// Deliberately conservative: only real column declarations, and only on tables (a
// view's columns are derived, so a stale view is a different check).
const expected = new Map<string, Set<string>>();
const views = new Set<string>();
// Allowed-value lists: constraint name → the quoted values its `col in (...)` admits.
// The latest migration to define a name wins; a drop removes it (D-110).
const checks = new Map<string, { table: string; values: Set<string> }>();
const quoted = (list: string) => new Set([...list.matchAll(/'([^']*)'/g)].map((q) => q[1]));
const IN_LIST = /check\s*\(\s*\(?\s*([a-z_][a-z0-9_]*)\s+in\s*\(([^)]*)\)/i;
const add = (t: string, c: string) => {
  if (!expected.has(t)) expected.set(t, new Set());
  expected.get(t)!.add(c);
};

const RESERVED = new Set([
  "constraint", "primary", "unique", "check", "foreign", "references", "create",
  "alter", "drop", "comment", "grant", "index", "on", "using", "with", "exclude",
]);

for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
  const sql = readFileSync(path.join(MIGRATIONS, file), "utf8")
    .replace(/--[^\n]*/g, "")            // strip line comments
    .replace(/\$\$[\s\S]*?\$\$/g, "");   // strip function bodies

  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?view\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi)) {
    views.add(m[1].toLowerCase());
  }

  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z0-9_.]+)\s*\(([\s\S]*?)\n\s*\)\s*;/gi)) {
    const table = m[1].toLowerCase().replace(/^public\./, "");
    // Split the body on top-level commas only — types like numeric(10,2) have their own.
    let depth = 0;
    let buf = "";
    const parts: string[] = [];
    for (const ch of m[2]) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (ch === "," && depth === 0) { parts.push(buf); buf = ""; continue; }
      buf += ch;
    }
    parts.push(buf);
    for (const p of parts) {
      const name = p.trim().split(/\s+/)[0]?.toLowerCase();
      if (name && /^[a-z_][a-z0-9_]*$/.test(name) && !RESERVED.has(name)) add(table, name);
      // A column's own check takes Postgres's default name, <table>_<column>_check;
      // a table-level one is named explicitly.
      const named = p.trim().match(/^constraint\s+([a-z0-9_]+)\s+/i);
      const inList = p.match(IN_LIST);
      if (inList && quoted(inList[2]).size > 0) {
        if (named) checks.set(named[1].toLowerCase(), { table, values: quoted(inList[2]) });
        else if (name && !RESERVED.has(name)) checks.set(`${table}_${name}_check`, { table, values: quoted(inList[2]) });
      }
    }
  }

  for (const m of sql.matchAll(
    /alter\s+table\s+(?:if\s+exists\s+)?([a-z0-9_.]+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/gi,
  )) {
    add(m[1].toLowerCase().replace(/^public\./, ""), m[2].toLowerCase());
  }

  // Constraints in file order, so a drop-then-add in one migration lands on the add.
  for (const m of sql.matchAll(
    /alter\s+table\s+(?:if\s+exists\s+)?([a-z0-9_.]+)\s+(drop\s+constraint\s+(?:if\s+exists\s+)?([a-z0-9_]+)|add\s+constraint\s+([a-z0-9_]+)\s+(check\s*\([\s\S]*?\)\s*\)))\s*;/gi,
  )) {
    const table = m[1].toLowerCase().replace(/^public\./, "");
    if (m[3]) checks.delete(m[3].toLowerCase());
    else if (m[4]) {
      const inList = m[5].match(IN_LIST);
      if (inList && quoted(inList[2]).size > 0) checks.set(m[4].toLowerCase(), { table, values: quoted(inList[2]) });
    }
  }

  for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?([a-z0-9_.]+)\s+drop\s+column\s+(?:if\s+exists\s+)?([a-z0-9_]+)/gi)) {
    expected.get(m[1].toLowerCase().replace(/^public\./, ""))?.delete(m[2].toLowerCase());
  }
}

for (const v of views) expected.delete(v);

// ── What the database actually has ───────────────────────────────────────────────
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const probe = async (table: string, cols: string) => {
  const res = await fetch(`${URL_}/rest/v1/${table}?select=${cols}&limit=0`, { headers });
  return res.status;
};

let missing = 0;
let unreachable = 0;
const label = useLocal ? "local stack" : URL_.replace(/^https?:\/\//, "");
console.log(`schema-check → ${label}\n${expected.size} tables declared across the migration chain\n`);

for (const [table, cols] of [...expected].sort()) {
  const all = [...cols].sort();
  const status = await probe(table, all.join(","));
  if (status === 200) continue;

  // 404 = the table itself is absent; anything else, find the exact columns.
  if (status === 404) {
    console.error(`  ✕ ${table} — TABLE MISSING`);
    unreachable++;
    continue;
  }
  const gone: string[] = [];
  for (const c of all) if ((await probe(table, c)) !== 200) gone.push(c);
  if (gone.length === 0) {
    console.error(`  ? ${table} — probe returned ${status} but every column resolves individually`);
    continue;
  }
  console.error(`  ✕ ${table} — missing: ${gone.join(", ")}`);
  missing += gone.length;
}

// ── Allowed-value lists (D-110) ──────────────────────────────────────────────────
// A migration that only widens a `check (kind in (...))` adds no column, so the probe
// above cannot see it. 0030 was one, never applied, and it stopped Week 3's
// settlement. The live definitions come from ante_check_constraints() (0032).
let checkDrift = 0;
const rpc = await fetch(`${URL_}/rest/v1/rpc/ante_check_constraints`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: "{}",
});
if (rpc.status !== 200) {
  console.error(`  ✕ ante_check_constraints() unavailable (HTTP ${rpc.status}) — apply migration 0032; allowed-value lists are UNVERIFIED`);
  checkDrift++;
} else {
  const live = new Map(
    ((await rpc.json()) as Array<{ conname: string; definition: string }>).map((r) => [r.conname, quoted(r.definition)]),
  );
  for (const [name, want] of [...checks].sort(([a], [b]) => a.localeCompare(b))) {
    const have = live.get(name);
    if (!have) {
      console.error(`  ✕ ${want.table} — check constraint ${name} MISSING`);
      checkDrift++;
      continue;
    }
    const lacking = [...want.values].filter((v) => !have.has(v));
    const extra = [...have].filter((v) => !want.values.has(v));
    if (lacking.length || extra.length) {
      console.error(
        `  ✕ ${want.table}.${name} — ${lacking.length ? `does not allow: ${lacking.join(", ")}` : ""}${lacking.length && extra.length ? "; " : ""}${extra.length ? `allows undeclared: ${extra.join(", ")}` : ""}`,
      );
      checkDrift++;
    }
  }
  console.log(`${checks.size} allowed-value lists declared; ${checks.size - checkDrift} match the target`);
}

if (missing === 0 && unreachable === 0 && checkDrift === 0) {
  console.log("✅ SCHEMA IN SYNC — every declared column and allowed-value list matches the target.");
  process.exit(0);
}
console.error(
  `\n❌ SCHEMA DRIFT — ${missing} column(s), ${unreachable} table(s) and ${checkDrift} allowed-value list(s) declared in supabase/migrations/ do not match ${label}.`,
);
console.error("   The deployed code expects them. Apply the outstanding migrations before shipping.");
process.exit(1);
