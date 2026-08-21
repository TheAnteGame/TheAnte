import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/db/fetchAll";

// The league record, in one file (D-015).
//
// What is in here is everything that cannot be regenerated: the roster, the season,
// every ticket and bet, the ledger the whole chip-conservation invariant rests on,
// the chat, the audit trail, and the commissioner's own configuration.
//
// Two tables are deliberately excluded. feed_items refills itself every 15 minutes
// from the news feeds, and job_runs is operational telemetry that grows without
// bound — carrying either would bloat the file without protecting anything.

interface TableSpec {
  name: string;
  /** A stable sort key, so paged reads cannot shear. Composite where the table is. */
  orderBy: string[];
}

export const SNAPSHOT_TABLES: TableSpec[] = [
  { name: "teams", orderBy: ["code"] },
  { name: "players", orderBy: ["id"] },
  { name: "commissioner", orderBy: ["id"] },
  { name: "seasons", orderBy: ["id"] },
  { name: "weeks", orderBy: ["id"] },
  { name: "week_players", orderBy: ["week_id", "player_id"] },
  { name: "games", orderBy: ["id"] },
  { name: "tickets", orderBy: ["id"] },
  { name: "bets", orderBy: ["id"] },
  { name: "ledger_entries", orderBy: ["id"] },
  { name: "pot_awards", orderBy: ["id"] },
  { name: "mark_votes", orderBy: ["id"] },
  { name: "chat_messages", orderBy: ["id"] },
  { name: "moderation_actions", orderBy: ["id"] },
  { name: "support_messages", orderBy: ["id"] },
  { name: "audit_log", orderBy: ["id"] },
  { name: "notification_log", orderBy: ["id"] },
  { name: "content_blocks", orderBy: ["key"] },
  { name: "content_revisions", orderBy: ["id"] },
  { name: "app_settings", orderBy: ["key"] },
  { name: "feed_sources", orderBy: ["id"] },
  { name: "ticker_items", orderBy: ["id"] },
];

export interface LeagueSnapshot {
  format: 1;
  takenAt: string;
  reason: string;
  counts: Record<string, number>;
  /** Chip conservation at the moment of capture — the one number worth asserting. */
  chipTotal: number | null;
  tables: Record<string, unknown[]>;
}

export async function buildSnapshot(db: SupabaseClient, reason: string): Promise<LeagueSnapshot> {
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const spec of SNAPSHOT_TABLES) {
    const rows = await fetchAllRows<Record<string, unknown>>((from, to) => {
      let q = db.from(spec.name).select("*");
      for (const col of spec.orderBy) q = q.order(col);
      return q.range(from, to);
    });
    tables[spec.name] = rows;
    counts[spec.name] = rows.length;
  }

  // Chips are exactly conserved by construction; recording the sum makes a restored
  // or inspected file self-checking rather than something you have to trust.
  const ledger = tables.ledger_entries as Array<{ amount?: number }> | undefined;
  const chipTotal = ledger ? ledger.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) : null;

  return {
    format: 1,
    takenAt: new Date().toISOString(),
    reason,
    counts,
    chipTotal,
    tables,
  };
}

/** Keep the most recent snapshots and drop the rest — this database is small and free-tier. */
const KEEP = 20;

export async function takeSnapshot(
  db: SupabaseClient,
  reason: string,
  createdBy: string | null,
): Promise<{ id: string | null; error?: string }> {
  try {
    const snapshot = await buildSnapshot(db, reason);
    const payload = JSON.stringify(snapshot);
    const { data, error } = await db
      .from("league_snapshots")
      .insert({
        reason,
        created_by: createdBy,
        size_bytes: payload.length,
        chip_total: snapshot.chipTotal,
        payload: snapshot,
      })
      .select("id")
      .single();
    if (error) return { id: null, error: error.message };

    const { data: old } = await db
      .from("league_snapshots")
      .select("id")
      .order("created_at", { ascending: false })
      .range(KEEP, KEEP + 200);
    if (old && old.length > 0) {
      await db
        .from("league_snapshots")
        .delete()
        .in("id", old.map((r) => r.id));
    }
    return { id: data.id };
  } catch (err) {
    return { id: null, error: err instanceof Error ? err.message : String(err) };
  }
}
