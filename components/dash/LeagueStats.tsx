import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { gatherLeagueStats } from "@/lib/stats/gather";

// League Stats (D-022). Four numbers that stay fresh week to week and reward the
// thing the game actually rewards — being right when the room was wrong.
//
// Every figure is drawn from SETTLED weeks only, so this box sits perfectly still
// between the ante and the reveal (§6). And the one unflattering stat is aimed at the
// matchup, never at a player: §9 is deliberate that nobody is eliminated and the felt
// is a badge, so a weekly "biggest loser" callout is the one thing here that could
// make somebody quit.

export async function LeagueStats() {
  const db = createUserClient();
  const [heading, emptyMsg, biggestLabel, priceLabel, coldLabel, hotLabel, weekLabel, stats] = await Promise.all([
    getContent("dash.stats.heading"),
    getContent("dash.stats.empty"),
    getContent("dash.stats.biggest_week"),
    getContent("dash.stats.best_price"),
    getContent("dash.stats.coldest_take"),
    getContent("dash.stats.hot_hand"),
    getContent("dash.stats.week_label"),
    gatherLeagueStats(db),
  ]);

  const { highlights: h, nameOf } = stats;
  const rows: Array<{ label: string; value: string; who: string | null }> = [];

  if (h.biggestWeek) {
    rows.push({ label: biggestLabel, value: `+${h.biggestWeek.value}`, who: nameOf(h.biggestWeek.playerId!) });
  }
  if (h.bestPrice) {
    rows.push({
      label: priceLabel,
      value: `${h.bestPrice.value.multiplier.toFixed(2)}× on ${h.bestPrice.value.team}`,
      who: nameOf(h.bestPrice.playerId!),
    });
  }
  if (h.coldestTake) {
    rows.push({
      label: coldLabel,
      value: h.coldestTake.value.team,
      who: `${h.coldestTake.value.backers} backed it`,
    });
  }
  if (h.hotHand) {
    rows.push({ label: hotLabel, value: `${h.hotHand.value} ${weekLabel}`, who: nameOf(h.hotHand.playerId!) });
  }

  return (
    <section aria-label={heading} className="panel">
      <h2 className="panel-head px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-chrome)]">
        {heading}
      </h2>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-[color:var(--color-text-mid)]">{emptyMsg}</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r) => (
            <li key={r.label} className="flex items-baseline gap-3 border-b border-[color:var(--color-border)] px-4 py-2.5 last:border-b-0">
              <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-low)]">
                {r.label}
              </span>
              <span className="nums font-[family-name:var(--font-display)] font-bold text-[color:var(--color-gold)]">
                {r.value}
              </span>
              {r.who && <span className="ml-auto text-xs text-[color:var(--color-text-mid)]">{r.who}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
