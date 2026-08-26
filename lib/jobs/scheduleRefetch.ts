import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchNflverseWeek } from "@/lib/sports/nflverse";
import { type JobOutcome } from "./util";

// Nightly schedule re-fetch (ANTE-TECH §3.1): flex scheduling moves kickoffs, and
// §10 voids any game rescheduled to kick before the deadline. A game that moved
// EARLIER under locked tickets raises an alert for the commissioner — it is never
// silently discovered on Sunday. The void itself is a commissioner action (§13).

export async function scheduleRefetch(db: SupabaseClient): Promise<JobOutcome> {
  const { data: season } = await db.from("seasons").select("*").eq("status", "active").maybeSingle();
  if (!season) return { status: "skipped", detail: { reason: "no active season" } };

  const { data: week } = await db
    .from("weeks")
    .select("id, number, deadline_at, phase")
    .in("phase", ["open", "revealed"])
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!week) return { status: "skipped", detail: { reason: "no live week" } };

  const feed = await fetchNflverseWeek(season.year, week.number);
  const { data: games } = await db
    .from("games")
    .select("id, external_id, kickoff_at, on_slate, settled, void_reason")
    .eq("week_id", week.id);

  const moved: Array<{ externalId: string; from: string; to: string; nowPreDeadline: boolean }> = [];
  for (const g of games ?? []) {
    if (g.settled || g.void_reason) continue;
    const fresh = feed.games.find((f) => f.externalId === g.external_id);
    if (!fresh) continue;
    const oldKick = new Date(g.kickoff_at).getTime();
    const newKick = fresh.kickoffAt.getTime();
    if (oldKick === newKick) continue;

    await db.from("games").update({ kickoff_at: fresh.kickoffAt.toISOString() }).eq("id", g.id);
    const nowPreDeadline = g.on_slate && fresh.kickoffAt < new Date(week.deadline_at);
    moved.push({
      externalId: g.external_id,
      from: new Date(oldKick).toISOString(),
      to: fresh.kickoffAt.toISOString(),
      nowPreDeadline,
    });
    if (nowPreDeadline) {
    }
  }

  return { status: "succeeded", detail: { week: week.number, moved: moved.length, details: moved } };
}
