import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SIDE_GAMES_FIRST_WEEK, SIDE_GAMES_LAST_WEEK } from "@/lib/engine";
import { takeSnapshot } from "@/lib/backup/snapshot";
import { alertCommissioner } from "./alert";
import { fetchPlayResults, playResultsUrl, postSideGames, type PlayResults } from "./sideGames";
import type { JobOutcome } from "./util";

// Side games pay out with the main game (D-139). The owner, 2026-11-19: Week 10's
// Bingo and Crunch Time were decided but never paid, because posting waited on a
// console button nobody pressed in the overnight window between Monday's settlement
// and Tuesday's slate open. Now the scores-sync tick (every five minutes, the same
// tick that settles a week) and slate.open both call this, so a week's side games land
// right after its settlement and before the next week opens on its stacks.
//
// It goes through the console's own door (postSideGames): every gate, the
// conservation check and the single insert are unchanged. This only decides WHEN.
//
// Which week: the settled weeks after the last one with side-game rows, oldest first.
// Rollover runs forward, so an earlier week can never post behind a later one, and a
// week whose games had no entrants simply has nothing to post and is passed over.
//
// Waiting is silent: ANTE Play not closed or not final yet (Bingo waits for Monday
// night's last final). Anything else — the next week already mid-blackout, malformed
// results, a failed conservation check — emails the commissioner, at most once a day
// per week, and stops; the console's Side games page still works by hand.

export type ResultsFetcher = (season: number, week: number) => Promise<PlayResults>;

export async function autoPostSideGames(db: SupabaseClient, fetchResults: ResultsFetcher = fetchPlayResults): Promise<JobOutcome> {
  if (fetchResults === fetchPlayResults && !playResultsUrl()) {
    return { status: "skipped", detail: { reason: "side games are switched off (ANTE_PLAY_RESULTS_URL unset)" } };
  }
  const { data: season } = await db.from("seasons").select("id, year").order("year", { ascending: false }).limit(1).maybeSingle();
  if (!season) return { status: "skipped", detail: { reason: "no season" } };

  const { data: weeks } = await db
    .from("weeks")
    .select("id, number, settled_at")
    .eq("season_id", season.id)
    .gte("number", SIDE_GAMES_FIRST_WEEK)
    .lte("number", SIDE_GAMES_LAST_WEEK)
    .order("number", { ascending: true });
  const { data: played } = await db.from("ledger_entries").select("week_id").like("idempotency_key", "play:%");
  const playedIds = new Set((played ?? []).map((r) => r.week_id));
  const lastPosted = Math.max(0, ...(weeks ?? []).filter((w) => playedIds.has(w.id)).map((w) => w.number));
  const candidates = (weeks ?? []).filter((w) => w.number > lastPosted && w.settled_at);
  if (candidates.length === 0) return { status: "skipped", detail: { reason: "no settled week waiting on side games" } };

  const posted: Array<{ week: number; message: string }> = [];
  for (const w of candidates) {
    let results: PlayResults;
    try {
      results = await fetchResults(season.year, w.number);
    } catch (e) {
      // ANTE Play unreachable or answering nonsense: retry next tick, quietly. If it
      // never comes back, the next week's slate open finds this week still unpaid and
      // the blackout check below raises it.
      return { status: "skipped", detail: { week: w.number, waiting: e instanceof Error ? e.message : String(e), posted } };
    }
    if (!results.closed || !results.final) {
      return { status: "skipped", detail: { week: w.number, waiting: "ANTE Play results not final yet", posted } };
    }

    const out = await postSideGames(db, results);
    if (out.status === "skipped") continue; // nothing to post (no entrants) or already in
    if (out.status === "failed") {
      await alertCommissioner(db, "side_games_stuck", w.number, out.message);
      return { status: "failed", detail: { week: w.number, error: out.message, posted } };
    }

    // The console takes a snapshot and writes an audit row before it posts; this
    // writes both after, because it posts unattended and only a success is worth a
    // record. The ledger rows themselves are the source of truth either way.
    await takeSnapshot(db, `after automatic side-game payout, week ${w.number}`, null);
    await db.from("audit_log").insert({
      actor_player_id: null,
      action: "sidegames.post",
      entity_type: "week",
      entity_id: String(w.number),
      reason: `Side-game results, Week ${w.number}: posted automatically after settlement (D-139)`,
      after: { status: out.status, message: out.message, rows: out.preview.rows.length } as unknown,
    });
    posted.push({ week: w.number, message: out.message });
  }
  return posted.length > 0 ? { status: "succeeded", detail: { posted } } : { status: "skipped", detail: { reason: "nothing to post" } };
}
