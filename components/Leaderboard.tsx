import { createUserClient } from "@/lib/db/supabase";
import { fetchAllRows } from "@/lib/db/fetchAll";
import { getContent } from "@/lib/content/getContent";
import { LeaderboardTable, type LbCopy, type LbRow } from "./LeaderboardTable";

// Server assembly: the standings view (RLS: approved-only, blackout-safe by
// construction — its bet stats draw only from revealed weeks) plus this week's
// ledger delta and felt badges. During the blackout the delta is the ante for
// everyone, posted all at once on Tuesday — nothing here can twitch on a submission.

export async function Leaderboard({ playerId }: { playerId: string }) {
  const db = createUserClient();

  const [{ data: standings }, { data: week }] = await Promise.all([
    db.from("standings").select("*").order("rank"),
    db
      .from("weeks")
      .select("id")
      .in("phase", ["open", "revealed", "settled"])
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

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

  const rows: LbRow[] = (standings ?? []).map((s) => {
    const decided = (s.bets_won ?? 0) + (s.bets_lost ?? 0);
    return {
      playerId: s.player_id,
      name: `${s.first_name ?? ""} ${(s.last_name ?? "").slice(0, 1)}.`.trim() || "—",
      status: s.status ?? "approved",
      stack: s.stack ?? 0,
      delta: week ? (deltas.get(s.player_id) ?? 0) : null,
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
      <h2 className="panel-head px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-chrome)]">
        {copy.heading}
      </h2>
      <LeaderboardTable rows={rows} copy={copy} />
    </section>
  );
}
