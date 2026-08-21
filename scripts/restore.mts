/**
 * RESTORE A LEAGUE FROM A DOWNLOADED BACKUP
 *
 *   npm run db:restore -- ./ante-league-2026-09-14.json --verify
 *   npm run db:restore -- ./ante-league-2026-09-14.json --db-url "postgresql://…" --confirm
 *
 * A command-line tool, not a button: it writes every table in the league record, and
 * that is not something anyone should be one mis-click away from. It targets a FRESH,
 * EMPTY database — a new Supabase project, or one whose schema has just been rebuilt
 * by running the migrations.
 *
 * It is NOT the tool for "the reveal came out wrong". For that, re-settle the week from
 * the console: the ledger is append-only, so a re-settlement corrects the numbers AND
 * leaves the record of what happened, which a restore would erase.
 *
 * WHY A DIRECT POSTGRES CONNECTION, NOT THE REST API
 * The 0002 guards fire for the service role too — that is deliberate (ANTE-TECH §4.1).
 * One of them, bets_with_ticket_only, requires a bet to be inserted in the SAME
 * transaction as its ticket, so a restore that writes tickets and then bets is rejected
 * row for row. A drill against a scratch database caught exactly that. Loading through
 * Postgres directly lets the restore run as one transaction with
 * `session_replication_role = replica`, which is the standard way to load a dump:
 * triggers and FK checks stand down for the load and are back on the moment it commits.
 *
 * Get the connection string from Supabase → Project Settings → Database → Connection
 * string (URI), or set SUPABASE_DB_URL.
 *
 * Guards, in order:
 *   1. Refuses to run without --confirm.
 *   2. Refuses if the target already holds players, unless --force.
 *   3. Loads inside ONE transaction — it all lands or none of it does.
 *   4. Drops ticker_items.feed_item_id when the headline is not in the file, because
 *      headlines are excluded from backups: they re-ingest themselves.
 *   5. Verifies the restored ledger against the chip total recorded in the file, and
 *      rolls the whole thing back on a mismatch.
 *
 * And --verify proves a FILE with no database involved at all.
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";

const [, , filePath, ...flags] = process.argv;
const flag = (name: string) => {
  const i = flags.indexOf(name);
  return i >= 0 ? flags[i + 1] : undefined;
};
const confirm = flags.includes("--confirm");
const force = flags.includes("--force");
const verifyOnly = flags.includes("--verify");
const dbUrl = flag("--db-url") ?? process.env.SUPABASE_DB_URL;

if (!filePath) {
  console.error("usage: npm run db:restore -- <backup.json> [--verify | --db-url <uri> --confirm [--force]]");
  process.exit(1);
}

// Parents first. With triggers stood down this is belt and braces, but a readable
// load order is worth keeping for anyone reading the output.
const ORDER = [
  "teams", "players", "commissioner", "seasons", "weeks", "games", "week_players",
  "tickets", "bets", "ledger_entries", "pot_awards", "mark_votes", "chat_messages",
  "moderation_actions", "support_messages", "audit_log", "notification_log",
  "content_blocks", "content_revisions", "app_settings", "feed_sources", "ticker_items",
] as const;

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

// ── --verify: prove the file on its own ───────────────────────────────────────
if (verifyOnly) {
  const problems: string[] = [];
  for (const table of ORDER) if (!(table in snapshot.tables)) problems.push(`missing table: ${table}`);

  const ledgerSum = (snapshot.tables.ledger_entries ?? []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  if (snapshot.chipTotal !== null && ledgerSum !== snapshot.chipTotal) {
    problems.push(`chip total says ${snapshot.chipTotal} but the ledger rows sum to ${ledgerSum}`);
  }

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

if (!dbUrl) {
  console.error("\nNo database. Pass --db-url <uri> or set SUPABASE_DB_URL.");
  console.error("Supabase → Project Settings → Database → Connection string (URI).");
  process.exit(1);
}

if (!confirm) {
  console.log("\nDry run. Nothing was written. Re-run with --confirm to restore, or --verify to check the file.");
  process.exit(0);
}

const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });

try {
  const [{ count: playerCount }] = await sql<{ count: number }[]>`select count(*)::int as count from players`;
  if (playerCount > 0 && !force) {
    console.error(
      `\nRefusing to write: the target already has ${playerCount} players.\n` +
        `This tool is for an empty database. If you truly mean to overwrite, re-run with --force.`,
    );
    await sql.end();
    process.exit(1);
  }

  await sql.begin(async (tx) => {
    // Stand the guards and FK checks down for the load. They are back on at COMMIT.
    await tx`set local session_replication_role = replica`;

    for (const table of ORDER) {
      let rows = snapshot.tables[table] ?? [];
      if (rows.length === 0) {
        console.log(`  ${table}: empty`);
        continue;
      }
      // Headlines are not backed up, so a ticker row pointing at one has nothing to point at.
      if (table === "ticker_items") rows = rows.map((r) => ({ ...r, feed_item_id: null }));

      for (let i = 0; i < rows.length; i += 500) {
        await tx`insert into ${tx(table)} ${tx(rows.slice(i, i + 500))}`;
      }
      console.log(`  ${table}: ${rows.length}`);
    }

    // Chips are exactly conserved by construction. If the restored ledger does not
    // match the file, the whole transaction rolls back rather than leaving a half-league.
    const [{ sum }] = await tx<{ sum: number }[]>`
      select coalesce(sum(amount), 0)::int as sum from ledger_entries`;
    if (snapshot.chipTotal !== null && sum !== snapshot.chipTotal) {
      throw new Error(`CHIP TOTAL MISMATCH — file says ${snapshot.chipTotal}, restore produced ${sum}. Rolled back.`);
    }
    console.log(`\nLedger total ${sum} matches the file.`);
  });

  console.log("Restored. News headlines were not in the backup; they refill on the next feeds sync.");
} catch (err) {
  console.error(`\nRestore FAILED and was rolled back — ${err instanceof Error ? err.message : String(err)}`);
  await sql.end();
  process.exit(1);
}

await sql.end();
