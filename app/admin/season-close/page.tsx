import { getCommissioner } from "@/lib/admin";
import { gatherSeasonData } from "@/lib/season";
import { championshipOrder, computeAwards } from "@/lib/engine/awards";
import { AdminForm } from "@/components/admin/AdminForm";
import { closeSeason, drawHighCard } from "../actions";
import { Section, thCls, tdCls } from "@/components/admin/ui";

// Season close (ANTE-ADMIN §4.10): final standings with every tiebreaker shown so
// the order is obviously earned, the one-shot high card, the marker write-off, and
// the lock. Deactivated players appear with their stack and an "out" marker —
// the exclusion is visible, not mysterious.

export const dynamic = "force-dynamic";

const AWARD_NAMES: Record<string, string> = {
  iron_stack: "The Iron Stack",
  chalk_eater: "The Chalk Eater",
  contrarian: "Contrarian of the Year",
  best_week: "Best Week",
  worst_shove: "Worst Shove",
  straus: "The Straus",
  straggler: "The Straggler",
};

export default async function SeasonClose() {
  const ctx = (await getCommissioner())!;
  const season = await gatherSeasonData(ctx.db);
  const order = championshipOrder(season.standings);
  const awards = computeAwards(season.awardsInput);
  const { data: seasonRow } = await ctx.db.from("seasons").select("status").order("year", { ascending: false }).limit(1).maybeSingle();

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">
        Season close {seasonRow?.status === "complete" ? "— CLOSED" : season.allSettled ? "" : "— waiting on Week 18"}
      </h1>

      <Section title="Final standings — tiebreakers shown (§11)">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[color:var(--color-border)]">
              <th className={thCls}>#</th>
              <th className={thCls}>Player</th>
              <th className={thCls}>Stack</th>
              <th className={thCls}>Winning bets</th>
              <th className={thCls}>Pots</th>
              <th className={thCls}>Folds</th>
            </tr>
          </thead>
          <tbody>
            {order.map((s, i) => (
              <tr key={s.playerId} className={`border-b border-[color:var(--color-border)] last:border-b-0 ${s.eligible ? "" : "opacity-40"}`}>
                <td className={`${tdCls} nums`}>{i + 1}</td>
                <td className={tdCls}>
                  {season.names.get(s.playerId)}
                  {!s.eligible && <span className="ml-2 text-[10px] uppercase text-[color:var(--color-text-low)]">out</span>}
                </td>
                <td className={`${tdCls} nums font-semibold`}>{s.stack}</td>
                <td className={`${tdCls} nums`}>{s.winningBets}</td>
                <td className={`${tdCls} nums`}>{s.potsWon}</td>
                <td className={`${tdCls} nums`}>{s.weeksFolded}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Awards preview">
        <ul className="space-y-1 text-sm">
          {Object.entries(AWARD_NAMES).map(([key, name]) => {
            const a = awards[key];
            return (
              <li key={key}>
                <span className="text-[color:var(--color-gold)]">{name}:</span>{" "}
                {a ? (
                  <span className="text-[color:var(--color-text-hi)]">
                    {a.playerIds.map((id) => season.names.get(id)).join(", ")}{" "}
                    <span className="text-[color:var(--color-text-low)]">— {a.detail}</span>
                  </span>
                ) : (
                  <span className="text-[color:var(--color-text-low)]">unclaimed</span>
                )}
              </li>
            );
          })}
          <li>
            <span className="text-[color:var(--color-gold)]">The Mark:</span>{" "}
            <span className="text-[color:var(--color-text-low)]">voted by felt finishers, seven days after close (§12)</span>
          </li>
        </ul>
      </Section>

      {season.allSettled && seasonRow?.status === "active" && (
        <>
          <Section title="High card — only if a tie survives every tiebreaker">
            <p className="mb-3 text-sm text-[color:var(--color-text-mid)]">
              Commits a SHA-256 seed hash to Table Talk, then reveals the seed and the derived cards. One draw. The
              button refuses a second attempt — no re-run route exists (§11).
            </p>
            <AdminForm action={drawHighCard} submitLabel="Draw the high card" danger confirmText="Draw? This is the one draw. No re-draws, ever." inline />
          </Section>

          <Section title="Lock the season">
            {season.latestMarker > 0 && (
              <p className="mb-2 text-sm text-[color:var(--color-gold)]">
                A {season.latestMarker}-chip marker is outstanding — it cannot roll (there is no next week) and will be
                written off against the Pot&apos;s account at close (§8.10).
              </p>
            )}
            <AdminForm
              action={closeSeason}
              submitLabel="Close the 2026 season"
              danger
              confirmText="Close the season? Awards publish, The Mark opens for felt finishers, and no further writes are accepted. Tickets stay readable forever."
              inline
            />
          </Section>
        </>
      )}
    </div>
  );
}
