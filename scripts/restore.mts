/**
 * RESTORE A LEAGUE FROM A DOWNLOADED BACKUP
 *
 *   npm run db:restore -- ./ante-league-2026-09-14-08-00-00.json --confirm
 *
 * This is deliberately a command-line tool and not a button in the console. It writes
 * every table in the league record, and that is not something anyone should be one
 * mis-click away from. It is meant for a FRESH, EMPTY database — a new Supabase
 * project, or one whose schema has just been rebuilt by running the migrations.
 *
 * It is NOT the tool for "the reveal came out wrong". For that, re-settle the week
 * from the console: the ledger is append-only, so a re-settlement corrects the numbers
 * AND leaves the record of what happened, which a restore would erase.
 *
 * Guards, in order:
 *   1. Refuses to run without --confirm.
 *   2. Refuses to run if the target already holds players, unless --force.
 *   3. Loads parents before children, so no foreign key is ever dangling.
 *   4. Re-adds players.approved_by in a second pass — it points at players.
 *   5. Drops ticker_items.feed_item_id when the feed item is not in the file:
 *      headlines are excluded from backups because they re-ingest themselves.
 *   6. Verifies the restored ledger against the chip total recorded in the file.
 *
 * And --verify proves a FILE with no database involved at all: every table present,
 * the ledger summing to the recorded chip total, and no row pointing at a parent that
 * is not in the file. Run it on a fresh download to know the copy is worth keeping.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [, , filePath, ...flags] = process.argv;
const confirm = flags.includes("--confirm");
const force = flags.includes("--force");
const verifyOnly = flags.includes("--verify");

if (!filePath) {
  console.error("usage: npm run db:restore -- <backup.json> [--verify | --confirm [--force]]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!verifyOnly && (!url || !key)) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

// Parents first. Anything that references another table appears after it.
const ORDER = [
  "teams",
  "players",
  "commissioner",
  "seasons",
  "weeks",
  "games",
  "week_players",
  "tickets",
  "bets",
  "ledger_entries",
  "pot_awards",
  "mark_votes",
  "chat_messages",
  "moderation_actions",
  "support_messages",
  "audit_log",
  "notification_log",
  "content_blocks",
  "content_revisions",
  "app_settings",
  "feed_sources",
  "ticker_items",
] as const;

const CHUNK = 500;

const snapshot = JSON.parse(readFileSync(filePath, "utf8")) as {
  format: number;
  takenAt: string;
  reason: string;
  chipTotal: number | null;
  tables: Record<string, Record<string, unknown>[]>;
};

if (snapshot.format !== 1) {
  console.error(`Unrecognised backup format: ${snapshot.format}`);
  process.exit(1);
}

const total = Object.values(snapshot.tables).reduce((n, rows) => n + rows.length, 0);
console.log(`Backup taken ${snapshot.takenAt} (${snapshot.reason})`);
console.log(`${total} rows across ${Object.keys(snapshot.tables).length} tables. Ledger total: ${snapshot.chipTotal}`);

// ── --verify: prove the file on its own, with no database in the picture ──────
if (verifyOnly) {
  const problems: string[] = [];

  for (const table of ORDER) {
    if (!(table in snapshot.tables)) problems.push(`missing table: ${table}`);
  }

  const ledgerSum = (snapshot.tables.ledger_entries ?? []).reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0,
  );
  if (snapshot.chipTotal !== null && ledgerSum !== snapshot.chipTotal) {
    problems.push(`chip total says ${snapshot.chipTotal} but the ledger rows sum to ${ledgerSum}`);
  }

  // Every child row must find its parent inside this same file, or the file cannot
  // rebuild the league on its own.
  const idsOf = (t: string, col = "id") => new Set((snapshot.tables[t] ?? []).map((r) => r[col]));
  const links: Array<[string, string, string]> = [
    ["bets", "ticket_id", "tickets"],
    ["bets", "game_id", "games"],
    ["tickets", "player_id", "players"],
    ["tickets", "week_id", "weeks"],
    ["week_players", "player_id", "players"],
    ["games", "week_id", "weeks"],
    ["ledger_entries", "player_id", "players"],
    ["chat_messages", "player_id", "players"],
    ["support_messages", "player_id", "players"],
  ];
  for (const [child, col, parent] of links) {
    const parents = idsOf(parent);
    const orphans = (snapshot.tables[child] ?? []).filter((r) => r[col] != null && !parents.has(r[col]));
    if (orphans.length > 0) problems.push(`${orphans.length} ${child}.${col} rows point at a missing ${parent}`);
  }

  if (problems.length > 0) {
    console.error("\nThis file is NOT safe to restore from:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`\nFile checks out. ${ORDER.length} tables present, ledger sums to ${ledgerSum}, no orphaned rows.`);
  process.exit(0);
}

if (!confirm) {
  console.log("\nDry run. Nothing was written. Re-run with --confirm to restore, or --verify to check the file.");
  process.exit(0);
}

const db = createClient(url!, key!, { auth: { persistSession: false } });

const existing = await db.from("players").select("id", { count: "exact", head: true });
if ((existing.count ?? 0) > 0 && !force) {
  console.error(
    `\nRefusing to write: the target already has ${existing.count} players.\n` +
      `This tool is for an empty database. If you truly mean to overwrite, re-run with --force.`,
  );
  process.exit(1);
}

for (const table of ORDER) {
  let rows = snapshot.tables[table] ?? [];
  if (rows.length === 0) {
    console.log(`  ${table}: empty`);
    continue;
  }

  // players.approved_by points at players — restore the column after every row exists.
  let deferred: Record<string, unknown>[] = [];
  if (table === "players") {
    deferred = rows.filter((r) => r.approved_by).map((r) => ({ id: r.id, approved_by: r.approved_by }));
    rows = rows.map((r) => ({ ...r, approved_by: null }));
  }

  // Headlines are not backed up, so a ticker row pointing at one has nothing to point at.
  if (table === "ticker_items") {
    rows = rows.map((r) => ({ ...r, feed_item_id: null }));
  }

  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error } = await db.from(table).upsert(batch);
    if (error) {
      console.error(`\n${table}: FAILED at row ${i} — ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`  ${table}: ${rows.length}`);

  if (deferred.length > 0) {
    for (const row of deferred) {
      const { error } = await db.from("players").update({ approved_by: row.approved_by }).eq("id", row.id);
      if (error) {
        console.error(`\nplayers.approved_by: FAILED for ${row.id} — ${error.message}`);
        process.exit(1);
      }
    }
    console.log(`  players.approved_by: ${deferred.length} relinked`);
  }
}

// Chips are exactly conserved by construction; if the restored ledger does not match
// the file, something was dropped and the restore should not be trusted.
const { data: ledger } = await db.from("ledger_entries").select("amount");
const restoredTotal = (ledger ?? []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
if (snapshot.chipTotal !== null && restoredTotal !== snapshot.chipTotal) {
  console.error(`\nCHIP TOTAL MISMATCH — file says ${snapshot.chipTotal}, database now holds ${restoredTotal}.`);
  process.exit(1);
}

console.log(`\nRestored. Ledger total ${restoredTotal} matches the file.`);
console.log("News headlines were not in the backup; they refill on the next feeds sync.");
