import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchEspnWeek } from "@/lib/sports/espn";
import { settleCurrentWeek } from "./settle";
import type { JobOutcome } from "./util";

// scores.sync (ANTE-ADMIN §5): every 5 minutes during game windows. ESPN owns live
// status and score — never spreads, never the canonical id (ANTE-TECH §3.1). When
// the last on-slate game goes final, settlement runs in the same tick.

export async function scoresSync(db: SupabaseClient): Promise<JobOutcome> {
  const { data: season } = await db.from("seasons").select("*").eq("status", "active").maybeSingle();
  if (!season) return { status: "skipped", detail: { reason: "no active season" } };

  const { data: week } = await db
    .from("weeks")
    .select("id, number, phase")
    .in("phase", ["open", "revealed"])
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!week) return { status: "skipped", detail: { reason: "no live week" } };

  const { data: games } = await db.from("games").select("id, espn_id, status, settled, void_reason").eq("week_id", week.id);
  const updatable = (games ?? []).filter((g) => g.espn_id && !g.settled && !g.void_reason && g.status !== "final");
  if (updatable.length === 0) {
    return { status: "skipped", detail: { reason: "nothing to update" } };
  }

  const feed = await fetchEspnWeek(season.year, week.number);
  let updated = 0;
  for (const g of updatable) {
    const s = feed.statuses.get(g.espn_id!);
    if (!s || s.status === "scheduled") continue;
    const { error } = await db
      .from("games")
      .update({ status: s.status, away_score: s.awayScore, home_score: s.homeScore })
      .eq("id", g.id);
    if (!error) updated++;
  }

  // Trigger settlement when the board is done (revealed weeks only).
  let settlement: JobOutcome | null = null;
  if (week.phase === "revealed") {
    settlement = await settleCurrentWeek(db);
  }

  return {
    status: "succeeded",
    detail: {
      week: week.number,
      updated,
      settlement: settlement ? settlement.status : "not attempted",
    },
  };
}
