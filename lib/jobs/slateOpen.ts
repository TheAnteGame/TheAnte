import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSlateOpen, anteForWeek } from "@/lib/engine";
import type { EngineLedgerEntry, EnginePlayer } from "@/lib/engine";
import { fetchNflverseWeek, type NflverseFetch } from "@/lib/sports/nflverse";
import { nowET, weekAnchors } from "@/lib/time";
import { emailPlayer } from "@/lib/notify/templates";
import { stacksByPlayer, type JobOutcome } from "./util";

// slate.open (ANTE-ADMIN §5): freeze spreads, snapshot the median BEFORE antes,
// snapshot the places tier and active count, evaluate felt pre-ante, create the week,
// deduct antes into the Pot, open submissions. Idempotent: the ledger's unique
// (week_id, idempotency_key, player_id) index makes a double ante impossible
// (acceptance test 16), and a re-run of a completed open is a no-op.

export async function slateOpen(db: SupabaseClient): Promise<JobOutcome> {
  const { data: season } = await db.from("seasons").select("*").eq("status", "active").maybeSingle();
  if (!season) return { status: "skipped", detail: { reason: "no active season" } };

  const weekNumber = (season.current_week ?? 0) + 1;
  if (weekNumber > 18) return { status: "skipped", detail: { reason: "season is over (§14)" } };

  const feed = await fetchNflverseWeek(season.year, weekNumber);
  const firstKick = feed.games.reduce((min, g) => (g.kickoffAt < min ? g.kickoffAt : min), feed.games[0].kickoffAt);
  const { opensAt, deadlineAt } = weekAnchors(firstKick);

  if (nowET().toJSDate() < opensAt) {
    return { status: "skipped", detail: { reason: `week ${weekNumber} opens ${opensAt.toISOString()}` } };
  }

  return openWeekCore(db, season, weekNumber, feed, { opensAt, deadlineAt });
}

/** The core of slate.open, with the feed and anchors injected. Production always
 *  arrives here through slateOpen (real feed, real Tuesdays); the season torture
 *  test drives it directly so 18 weeks can run in minutes against a real database.
 *  Identical writes either way — this seam adds no test-only behavior. */
export async function openWeekCore(
  db: SupabaseClient,
  season: { id: string; year: number },
  weekNumber: number,
  feed: NflverseFetch,
  anchors: { opensAt: Date; deadlineAt: Date },
): Promise<JobOutcome> {
  const { opensAt, deadlineAt } = anchors;

  // The week row is the idempotency gate for everything below the ledger's own.
  const { data: existing } = await db
    .from("weeks")
    .select("id, median_snapshot")
    .eq("season_id", season.id)
    .eq("number", weekNumber)
    .maybeSingle();
  if (existing?.median_snapshot != null) {
    return { status: "skipped", detail: { reason: `week ${weekNumber} already open` } };
  }

  const stacks = await stacksByPlayer(db);
  const potBefore = stacks.get("__pot__") ?? 0;

  let weekId = existing?.id;
  if (!weekId) {
    const { data: created, error } = await db
      .from("weeks")
      .insert({
        season_id: season.id,
        number: weekNumber,
        ante: anteForWeek(weekNumber),
        phase: "open",
        opens_at: opensAt.toISOString(),
        deadline_at: deadlineAt.toISOString(),
        pot_before: potBefore,
      })
      .select("id")
      .single();
    if (error) throw new Error(`week insert failed: ${error.message}`);
    weekId = created.id;
  }

  // Freeze the slate. Games kicking before Thursday noon are off-slate (§3) — the
  // 2026 Week 1 Wednesday opener and the Week 12 Wednesday game arrive here.
  const oddsByGame = new Map(feed.spreads.map((s) => [s.externalId, s]));
  const gameRows = feed.games.map((g) => ({
    week_id: weekId,
    external_id: g.externalId,
    espn_id: g.espnId,
    away_team: g.awayTeam,
    home_team: g.homeTeam,
    spread_frozen: oddsByGame.get(g.externalId)?.spreadLine ?? null,
    away_moneyline: oddsByGame.get(g.externalId)?.awayMoneyline ?? null,
    home_moneyline: oddsByGame.get(g.externalId)?.homeMoneyline ?? null,
    kickoff_at: g.kickoffAt.toISOString(),
    on_slate: g.kickoffAt >= deadlineAt,
  }));
  const { error: gamesError } = await db.from("games").upsert(gameRows, { onConflict: "external_id" });
  if (gamesError) throw new Error(`games upsert failed: ${gamesError.message}`);

  // The engine computes the week's opening state from pre-ante stacks.
  const { data: playerRows, error: playersError } = await db
    .from("players")
    .select("id, status, shove_used_week")
    .in("status", ["approved", "deactivated"]);
  if (playersError) throw new Error(`players read failed: ${playersError.message}`);

  const enginePlayers: EnginePlayer[] = (playerRows ?? []).map((p) => ({
    id: p.id,
    status: p.status as "approved" | "deactivated",
    stackPreAnte: stacks.get(p.id) ?? 0,
    shoveUsedWeek: p.shove_used_week,
  }));

  const slate = computeSlateOpen(enginePlayers, weekNumber);

  // One atomic insert; per-row idempotency keys; pot sides aggregated per kind so the
  // unique index holds. A retried cron cannot ante the league twice.
  const ledgerRows = toLedgerRows(slate.entries, weekId!, weekNumber);
  if (ledgerRows.length > 0) {
    const { error: ledgerError } = await db.from("ledger_entries").insert(ledgerRows);
    if (ledgerError && !ledgerError.message.includes("duplicate key")) {
      throw new Error(`ante posting failed: ${ledgerError.message}`);
    }
  }

  // Per-player snapshot: felt status and house limit, fixed for the week (0007).
  const snapshotRows = enginePlayers
    .filter((p) => p.status === "approved")
    .map((p) => ({
      week_id: weekId,
      player_id: p.id,
      stack_pre_ante: p.stackPreAnte,
      felt: slate.feltPlayerIds.has(p.id),
      house_limit: slate.houseLimits.get(p.id) ?? 0,
    }));
  if (snapshotRows.length > 0) {
    const { error: snapError } = await db
      .from("week_players")
      .upsert(snapshotRows, { onConflict: "week_id,player_id" });
    if (snapError) throw new Error(`week_players snapshot failed: ${snapError.message}`);
  }

  const { error: weekError } = await db
    .from("weeks")
    .update({
      median_snapshot: slate.medianSnapshot,
      places_tier_snapshot: slate.placesTierSnapshot,
      active_count_snapshot: slate.activeCountSnapshot,
    })
    .eq("id", weekId);
  if (weekError) throw new Error(`week snapshot write failed: ${weekError.message}`);

  await db.from("seasons").update({ current_week: weekNumber }).eq("id", season.id);

  // Slate-open email (ADMIN §4.7) — limits vary per player, so send individually.
  const { data: approvedPlayers } = await db.from("players").select("id, email").eq("status", "approved");
  for (const p of approvedPlayers ?? []) {
    await emailPlayer(
      db,
      p,
      "notify.slate_open",
      `ANTE — Week ${weekNumber} is open`,
      { week: weekNumber, ante: anteForWeek(weekNumber), limit: slate.houseLimits.get(p.id) ?? 0 },
      `notify.slate_open:w${weekNumber}`,
    );
  }

  return {
    status: "succeeded",
    detail: {
      week: weekNumber,
      games: gameRows.length,
      onSlate: gameRows.filter((g) => g.on_slate).length,
      median: slate.medianSnapshot,
      felt: [...slate.feltPlayerIds].length,
      feedRows: feed.raw.length,
    },
  };
}

function toLedgerRows(entries: EngineLedgerEntry[], weekId: string, weekNumber: number) {
  const rows: Array<Record<string, unknown>> = [];
  const potTotals = new Map<string, { amount: number; reason: string }>();

  for (const e of entries) {
    if (e.account === null) {
      const t = potTotals.get(e.kind) ?? { amount: 0, reason: e.reason };
      t.amount += e.amount;
      potTotals.set(e.kind, t);
    } else {
      rows.push({
        player_id: e.account,
        week_id: weekId,
        kind: e.kind,
        amount: e.amount,
        reason: e.reason,
        idempotency_key: `open:${e.kind}`,
      });
    }
  }
  for (const [kind, t] of potTotals) {
    rows.push({
      player_id: null,
      week_id: weekId,
      kind,
      amount: t.amount,
      reason: `Week ${weekNumber} — Pot side of ${kind}`,
      idempotency_key: `open:${kind}:pot`,
    });
  }
  return rows;
}
