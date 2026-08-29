import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SLATE_MARGIN_MINUTES, computeSlateOpen, anteForWeek } from "@/lib/engine";
import type { EngineLedgerEntry, EnginePlayer } from "@/lib/engine";
import { fetchNflverseWeek, type NflverseFetch } from "@/lib/sports/nflverse";
import { nowET, weekAnchors } from "@/lib/time";
import { emailDoc } from "@/lib/notify/templates";
import { weekOpen as weekOpenDoc } from "@/lib/notify/docs";
import { fetchAllRows } from "@/lib/db/fetchAll";
import { DateTime } from "luxon";
import { ET } from "@/lib/time";
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

/** D-035 — open the next week's betting window NOW instead of at its Tuesday 6am
 *  anchor. Same feed, same deadline (Thursday noon stays in stone), same core —
 *  the ONLY thing that moves is opens_at. Built for Week 1: the owner wants every
 *  newly approved player walking out of the tutorial onto a live board, however
 *  early they join. Guarded by its caller (commissioner action, typed reason). */
export async function slateOpenEarly(db: SupabaseClient): Promise<JobOutcome> {
  const { data: season } = await db.from("seasons").select("*").eq("status", "active").maybeSingle();
  if (!season) return { status: "skipped", detail: { reason: "no active season" } };

  const weekNumber = (season.current_week ?? 0) + 1;
  if (weekNumber > 18) return { status: "skipped", detail: { reason: "season is over (§14)" } };

  const feed = await fetchNflverseWeek(season.year, weekNumber);
  const firstKick = feed.games.reduce((min, g) => (g.kickoffAt < min ? g.kickoffAt : min), feed.games[0].kickoffAt);
  const { deadlineAt } = weekAnchors(firstKick);

  const now = nowET().toJSDate();
  if (now >= deadlineAt) {
    return { status: "skipped", detail: { reason: `week ${weekNumber}'s deadline has already passed` } };
  }

  return openWeekCore(db, season, weekNumber, feed, { opensAt: now, deadlineAt });
}

/** The core of slate.open, with the feed and anchors injected. Production always
 *  arrives here through slateOpen (real feed, real Tuesdays); the season torture
 *  test drives it directly so 18 weeks can run in minutes against a real database.
 *  Identical writes either way — this seam adds no test-only behavior. */
export async function openWeekCore(
  db: SupabaseClient,
  season: { id: string; year: number; week1_lock_at?: string | null },
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

    // The roster locks at the Week 1 deadline (§1, §13) — "this power is preseason-only
    // and dies at the Week 1 deadline along with the roster." Nothing ever wrote that
    // moment down (D-046): week1_lock_at was read in five places and set in none, so
    // admissionOpen returned true forever and Approve/Reject stayed live all season.
    // Week 1 opening is the moment the deadline first exists, so it is the moment to
    // record it. Never overwrites a lock the commissioner set by hand.
    if (weekNumber === 1 && !season.week1_lock_at) {
      await db
        .from("seasons")
        .update({ week1_lock_at: deadlineAt.toISOString() })
        .eq("id", season.id)
        .is("week1_lock_at", null);
    }
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
    on_slate: g.kickoffAt.getTime() >= deadlineAt.getTime() + SLATE_MARGIN_MINUTES * 60_000,
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

  // The Tuesday email (D-056): last week's result and the table, then the new week's
  // ante, limit and wall. Limits are per player, so it is composed one at a time.
  // Same rule as the reveal: the antes are already posted and the week is open. A
  // mail failure is a mail failure, not a failed slate open.
  try {
    await sendWeekOpenMail(db, weekId!, weekNumber, deadlineAt, slate.houseLimits);
  } catch (e) {
    console.error(`week-open mail failed for week ${weekNumber}:`, e);
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

/** Tuesday morning: how last week finished, where everyone stands, and that the new
 *  board is live. Replaces the old one-line slate-open note and the Monday settlement
 *  note, which is now silent (D-056).
 *
 *  Every figure here comes from the ledger and from weeks already revealed, so there
 *  is no blackout exposure: the week being opened has no tickets in it yet. */
async function sendWeekOpenMail(
  db: SupabaseClient,
  weekId: string,
  weekNumber: number,
  deadlineAt: Date,
  houseLimits: Map<string, number>,
): Promise<void> {
  const { data: players } = await db
    .from("players")
    .select("id, email, first_name, last_name")
    .eq("status", "approved");
  if (!players || players.length === 0) return;

  const deadline = DateTime.fromJSDate(deadlineAt).setZone(ET).toFormat("cccc h:mma 'ET'");
  const ante = anteForWeek(weekNumber);
  const nameOf = new Map(players.map((p) => [p.id, `${p.first_name ?? "?"} ${(p.last_name ?? "").slice(0, 1)}.`.trim()]));

  // Week 1 has nothing to recap.
  const prevWeek = weekNumber > 1 ? weekNumber - 1 : null;
  let leaders: Array<{ rank: string; name: string; stack: string; delta: string }> = [];
  const deltaOf = new Map<string, number>();
  const stackOf = new Map<string, number>();
  let potWinner = "";
  let potAmount = 0;

  if (prevWeek !== null) {
    const { data: prev } = await db.from("weeks").select("id").eq("number", prevWeek).maybeSingle();

    const entries = await fetchAllRows<{ player_id: string | null; amount: number; week_id: string | null }>(
      (f, t) => db.from("ledger_entries").select("player_id, amount, week_id").order("id").range(f, t),
    );
    for (const e of entries ?? []) {
      if (!e.player_id) continue;
      stackOf.set(e.player_id, (stackOf.get(e.player_id) ?? 0) + e.amount);
      if (prev && e.week_id === prev.id) deltaOf.set(e.player_id, (deltaOf.get(e.player_id) ?? 0) + e.amount);
    }

    if (prev) {
      const { data: awards } = await db.from("pot_awards").select("player_id, amount, place").eq("week_id", prev.id).order("place");
      const top = (awards ?? [])[0];
      if (top) {
        potWinner = nameOf.get(top.player_id) ?? "";
        potAmount = (awards ?? []).filter((a) => a.player_id === top.player_id).reduce((s, a) => s + a.amount, 0);
      }
    }

    // The real standings. The old settlement email shipped a hardcoded em dash here
    // and never computed a rank at all.
    leaders = [...stackOf.entries()]
      .filter(([id]) => nameOf.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, stack], i) => {
        const d = deltaOf.get(id) ?? 0;
        return {
          rank: String(i + 1),
          name: nameOf.get(id) ?? "?",
          stack: String(stack),
          delta: (d >= 0 ? "+" : "-") + Math.abs(d),
        };
      });
  }

  const rankOf = new Map(leaders.map((l) => [l.name, l.rank]));

  for (const p of players) {
    if (!p.email) continue;
    const nm = nameOf.get(p.id) ?? "";
    const d = deltaOf.get(p.id) ?? 0;
    await emailDoc(
      db,
      p,
      "notify.slate_open",
      `ANTE: Week ${weekNumber} is open`,
      weekOpenDoc({
        firstName: p.first_name ?? "Hello",
        week: weekNumber,
        ante,
        limit: houseLimits.get(p.id) ?? 0,
        deadline,
        prevWeek,
        delta: (d >= 0 ? "+" : "-") + Math.abs(d),
        stack: stackOf.get(p.id) ?? 0,
        rank: rankOf.get(nm) ?? "-",
        potWinner,
        potAmount,
        leaders,
      }),
      `notify.slate_open:w${weekNumber}:${p.id}`,
    );
  }
}
