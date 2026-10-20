import type { SupabaseClient } from "@supabase/supabase-js";
import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { gatherLeagueStats } from "@/lib/stats/gather";
import { PlayerTip } from "../ui/PlayerTip";

// League Stats (D-022). Four numbers that stay fresh week to week and reward the
// thing the game actually rewards — being right when the room was wrong.
//
// Every figure is drawn from SETTLED weeks only, so this box sits perfectly still
// between the ante and the reveal (§6). And the one unflattering stat is aimed at the
// matchup, never at a player: §9 is deliberate that nobody is eliminated and the felt
// is a badge, so a weekly "biggest loser" callout is the one thing here that could
// make somebody quit.

const ordinal = (n: number) => {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${tail}`;
};

/** dbOverride: the local preview harness only (see PlayStyleCard). */
export async function LeagueStats({ dbOverride }: { dbOverride?: SupabaseClient } = {}) {
  const db = dbOverride ?? createUserClient();
  const [heading, emptyMsg, climbLabel, priceLabel, burnedLabel, burnedWho, streakLabel, streakValue, streakOne, stats] = await Promise.all([
    getContent("dash.stats.heading"),
    getContent("dash.stats.empty"),
    getContent("dash.stats.biggest_climb"),
    getContent("dash.stats.best_price"),
    getContent("dash.stats.coldest_take"),
    getContent("dash.stats.burned_who"),
    getContent("dash.stats.hot_hand"),
    getContent("dash.stats.week_label"),
    getContent("dash.stats.week_label_one"),
    gatherLeagueStats(db),
  ]);

  const { highlights: h, climb, nameOf, fullNameOf, teamOf } = stats;
  const rows: Array<{ label: string; value: string; who: string | null; whoPlayerId?: string }> = [];

  // Biggest climb (D-114) replaces "biggest week", which mostly repeated who won the Pot.
  if (climb) {
    rows.push({
      label: climbLabel,
      value: `${ordinal(climb.from)} \u2192 ${ordinal(climb.to)}`,
      who: nameOf(climb.playerId),
      whoPlayerId: climb.playerId,
    });
  }
  if (h.bestPrice) {
    rows.push({
      label: priceLabel,
      value: `${h.bestPrice.value.multiplier.toFixed(2)}× on ${h.bestPrice.value.team}`,
      who: nameOf(h.bestPrice.playerId!),
      whoPlayerId: h.bestPrice.playerId!,
    });
  }
  // The most-backed side that lost. Aimed at the matchup, never at a player.
  if (h.coldestTake) {
    rows.push({
      label: burnedLabel,
      value: h.coldestTake.value.team,
      who: burnedWho.replaceAll("{n}", String(h.coldestTake.value.backers)),
    });
  }
  // Weeks in a row the player GAINED chips — not weeks they won the Pot (D-114: the
  // old "2 weeks up" read as two Pots).
  if (h.hotHand) {
    rows.push({
      label: streakLabel,
      value: h.hotHand.value === 1 ? streakOne : streakValue.replaceAll("{n}", String(h.hotHand.value)),
      who: nameOf(h.hotHand.playerId!),
      whoPlayerId: h.hotHand.playerId!,
    });
  }

  return (
    <section aria-label={heading} className="panel">
      <h2 className="panel-head px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-heading)]">
        {heading}
      </h2>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-[color:var(--color-text-mid)]">{emptyMsg}</p>
      ) : (
        <ul className="flex flex-col text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex items-baseline gap-3 border-b border-[color:var(--color-border)] px-4 py-2 last:border-b-0">
              {/* Plain-case label and a semibold value, the same as the play-style card
                  above it, so the column reads as one set of boxes (D-114). */}
              <span className="w-32 shrink-0 text-[color:var(--color-text-mid)]">{r.label}</span>
              <span className="nums font-semibold text-[color:var(--color-text-hi)]">{r.value}</span>
              {r.who && r.whoPlayerId ? (
                <span className="ml-auto text-right">
                  <PlayerTip fullName={fullNameOf(r.whoPlayerId)} team={teamOf(r.whoPlayerId)} playerId={r.whoPlayerId}>
                    <span className="text-xs text-[color:var(--color-text-mid)]">{r.who}</span>
                  </PlayerTip>
                </span>
              ) : (
                r.who && <span className="ml-auto text-right text-xs text-[color:var(--color-text-mid)]">{r.who}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
