import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchEspnWeek } from "@/lib/sports/espn";
import { settleCurrentWeek } from "./settle";
import { slateOpen } from "./slateOpen";
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

  let updated = 0;
  if (week) {
    const { data: games } = await db.from("games").select("id, espn_id, status, settled, void_reason").eq("week_id", week.id);
    const updatable = (games ?? []).filter((g) => g.espn_id && !g.settled && !g.void_reason && g.status !== "final");
    if (updatable.length > 0) {
      const feed = await fetchEspnWeek(season.year, week.number);
      for (const g of updatable) {
        const s = feed.statuses.get(g.espn_id!);
        if (!s || s.status === "scheduled") continue;
        const { error } = await db
          .from("games")
          .update({ status: s.status, away_score: s.awayScore, home_score: s.homeScore })
          .eq("id", g.id);
        if (!error) updated++;
      }
    }
  }

  // Settlement: whenever ANY week is revealed and unpaid, on every tick. It used to
  // run only when the newest week was the revealed one AND a score had just moved,
  // so a settlement that failed on the final score was never tried again: the next
  // tick found nothing to update, and once the next week opened the unpaid week was
  // not the newest any more (Week 3, 2026-09-29, D-110). settleCurrentWeek picks the
  // oldest revealed week, returns "skipped" while its games are unfinished, and is
  // idempotent, so asking every five minutes is cheap and safe.
  const { count: unpaid } = await db.from("weeks").select("id", { count: "exact", head: true }).eq("phase", "revealed");
  let settlement: JobOutcome | null = null;
  let opened: JobOutcome | null = null;
  if ((unpaid ?? 0) > 0) {
    settlement = await settleCurrentWeek(db);
    // A week held back behind an unpaid one (openWeekCore refuses to open on
    // unsettled stacks) opens here, the moment its predecessor settles, rather than
    // waiting for next Tuesday's cron. slateOpen is a no-op before the week's own
    // opening time and once it is already open.
    // A feed outage here must not turn a successful settlement into a failed job;
    // Tuesday's own slate.open cron still runs either way.
    if (settlement.status === "succeeded") {
      try {
        opened = await slateOpen(db);
      } catch (e) {
        opened = { status: "failed", detail: { error: e instanceof Error ? e.message : String(e) } };
      }
    }
  }

  if (!week && !settlement) return { status: "skipped", detail: { reason: "no live week" } };
  if (updated === 0 && !settlement) return { status: "skipped", detail: { reason: "nothing to update" } };

  return {
    status: settlement?.status === "failed" ? "failed" : "succeeded",
    detail: {
      week: week?.number ?? null,
      updated,
      settlement: settlement ? settlement.status : "not attempted",
      ...(settlement?.status === "failed" ? { settlementDetail: settlement.detail ?? null } : {}),
      ...(opened ? { slateOpen: opened.status } : {}),
    },
  };
}
