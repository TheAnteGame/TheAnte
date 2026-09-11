import { cache } from "react";
import { createUserClient } from "@/lib/db/supabase";
import { fetchAllRows } from "@/lib/db/fetchAll";
import { getContent } from "@/lib/content/getContent";
import { getTeamNames } from "@/lib/teams";
import { LeaderboardTable, type LbCopy, type LbRow } from "./LeaderboardTable";
import { loadProjection, withProjection } from "@/lib/stats/standings";

// Server assembly: the standings view (RLS: approved-only, blackout-safe by
// construction — its bet stats draw only from revealed weeks) plus this week's
// ledger delta and felt badges. During the blackout the delta is the ante for
// everyone, posted all at once on Tuesday — nothing here can twitch on a submission.

// One fetch per request, not per render (D-051). The dashboard mounts this component
// TWICE — once for the wide layout, once for the narrow one — and CSS hides whichever
// does not apply. Both still render on the server, so without this the standings, the
// week, the week_players snapshot and a PAGED SCAN OF THE WHOLE WEEK'S LEDGER all ran
// twice on every load, for a copy nobody ever sees. Harmless at 21 ledger rows;
// not harmless by Week 18, with the board polling every 5 seconds.
//
// React's cache() is per-request: it dedupes within a single render pass and is
// discarded when the request ends. No cache key is needed because nothing in here is
// per-player — the standings, the week, the deltas and the felt badges are the same
// league-wide table every approved player sees. The one personal value, isMe, is
// derived below from the prop, outside the memo. Nothing here writes: select()
// throughout, so this cannot alter a single chip.
const loadBoard = cache(async () => {
  const db = createUserClient();

  const [{ data: rawStandings }, { data: week }, { data: favTeams }, proj] = await Promise.all([
    db.from("standings").select("*"),
    db
      .from("weeks")
      .select("id")
      .in("phase", ["open", "revealed", "settled"])
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // The standings view has no favorite_team column of its own (it's a stats
    // rollup, not a profile projection) — fetched alongside it here for the
    // player-name tooltip rather than widening the view for one display field.
    db.from("players").select("id, favorite_team"),
    // The weekend projection (D-075). Stakes that can still come back belong on
    // their owner's line and profit already earned belongs there too, so the board
    // moves as each game goes final instead of sitting dead until Monday. The view's
    // own ORDER BY is dropped: it ranks the pre-adjustment number.
    loadProjection(db),
  ]);
  const standings = withProjection(rawStandings ?? [], proj);
  const favTeamOf = new Map((favTeams ?? []).map((p) => [p.id, p.favorite_team]));

  let deltas = new Map<string, number>();
  let felts = new Set<string>();
  if (week) {
    const [entries, { data: wps }] = await Promise.all([
      fetchAllRows<{ player_id: string | null; amount: number }>((f, t) =>
        db.from("ledger_entries").select("player_id, amount").eq("week_id", week.id).order("id").range(f, t),
      ),
      db.from("week_players").select("player_id, felt").eq("week_id", week.id),
    ]);
    deltas = new Map();
    for (const e of entries ?? []) {
      if (e.player_id) deltas.set(e.player_id, (deltas.get(e.player_id) ?? 0) + e.amount);
    }
    felts = new Set((wps ?? []).filter((w) => w.felt).map((w) => w.player_id));
  }

  return { standings, week, deltas, felts, favTeamOf, proj };
});

export async function Leaderboard({ playerId }: { playerId: string }) {
  const { standings, week, deltas, felts, favTeamOf, proj } = await loadBoard();
  const teamNames = await getTeamNames();

  const pj = (id: string) => proj?.byPlayer.get(id);

  const rows: LbRow[] = standings.map((s) => {
    const decided = (s.bets_won ?? 0) + (s.bets_lost ?? 0);
    const favTeam = favTeamOf.get(s.player_id);
    return {
      playerId: s.player_id,
      name: `${s.first_name ?? ""} ${(s.last_name ?? "").slice(0, 1)}.`.trim() || "—",
      fullName: `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "—",
      team: favTeam ? (teamNames.get(favTeam) ?? null) : null,
      status: s.status ?? "approved",
      stack: s.stack ?? 0,
      // The week's projected gain, not the raw ledger delta. The ledger delta during
      // the revealed window is ante + every stake withdrawn, i.e. the most negative
      // number a player will see all week and none of it decided. Adding back what
      // can still return plus the profit already banked makes this §14's gain as far
      // as the games have got: -ante - losses + profit.
      delta: week ? (deltas.get(s.player_id) ?? 0) + (pj(s.player_id)?.returnable ?? 0) + (pj(s.player_id)?.profit ?? 0) : null,
      atRisk: pj(s.player_id)?.atRisk ?? null,
      won: s.bets_won ?? 0,
      lost: s.bets_lost ?? 0,
      winPct: decided > 0 ? Math.round(((s.bets_won ?? 0) / decided) * 100) : null,
      pots: s.pots_won ?? 0,
      folds: s.weeks_folded ?? 0,
      avgMult: s.avg_multiplier,
      shoveUsedWeek: s.shove_used_week,
      felt: felts.has(s.player_id),
      isMe: s.player_id === playerId,
    };
  });

  const copy: LbCopy = {
    heading: await getContent("dash.leaderboard.heading"),
    empty: await getContent("dash.leaderboard.empty"),
    rank: await getContent("lb.rank"),
    player: await getContent("lb.player"),
    stack: await getContent("lb.stack"),
    delta: await getContent("lb.delta"),
    atRisk: await getContent("lb.at_risk"),
    won: await getContent("lb.won"),
    lost: await getContent("lb.lost"),
    winPct: await getContent("lb.win_pct"),
    pots: await getContent("lb.pots"),
    folds: await getContent("lb.folds"),
    avgMult: await getContent("lb.avg_mult"),
    shove: await getContent("lb.shove"),
    shoveHeld: await getContent("lb.shove_held"),
    feltBadge: await getContent("lb.felt_badge"),
    outBadge: await getContent("lb.out_badge"),
  };

  return (
    <section aria-label={copy.heading} className="panel">
      <h2 className="panel-head px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-heading)]">
        {copy.heading}
      </h2>
      <LeaderboardTable rows={rows} copy={copy} />
    </section>
  );
}
