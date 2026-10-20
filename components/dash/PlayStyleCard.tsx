import type { SupabaseClient } from "@supabase/supabase-js";
import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { gatherPlayProfiles } from "@/lib/stats/gatherStyle";
import { playStyleReport, type StyleNumbers } from "@/lib/stats/playStyle";

// Your play style (D-113), top of the right column. What kind of player you are,
// how you compare with the players on top, and the one habit where you differ most.
//
// Private by construction: it is rendered for the viewer alone, names nobody, and
// reports the top group only as averages. Built from SETTLED weeks, so it cannot move
// between the ante and the payout (§6).

/** dbOverride exists for the local preview harness only (same as WagerArea's): it
 *  renders the card as a seeded player without a Clerk session. */
export async function PlayStyleCard({ playerId, dbOverride }: { playerId: string; dbOverride?: SupabaseClient }) {
  // A read failure shows the empty card, never a broken dashboard: this box is a
  // nice-to-have beside the board, and must not be able to take the board down.
  let report: ReturnType<typeof playStyleReport> = null;
  try {
    report = playStyleReport(playerId, await gatherPlayProfiles(dbOverride ?? createUserClient()));
  } catch (e) {
    console.error("play style card:", e);
  }

  const t = (key: string, vars?: Record<string, string | number>) => getContent(`dash.style.${key}`, vars);
  const heading = await t("heading");

  if (!report) {
    return (
      <section aria-label={heading} className="panel">
        <h2 className="panel-head px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-heading)]">
          {heading}
        </h2>
        <p className="px-4 py-4 text-sm text-[color:var(--color-text-mid)]">{await t("empty")}</p>
      </section>
    );
  }

  const { style, me, top, league, meIsTop, topSize, hint } = report;
  const rows: Array<{ label: string; key: keyof StyleNumbers; fmt: (n: number) => string }> = [
    { label: await t("row.win"), key: "winPct", fmt: (n) => `${n}%` },
    { label: await t("row.crowd"), key: "crowdPct", fmt: (n) => `${n}%` },
    { label: await t("row.games"), key: "gamesPerWeek", fmt: (n) => n.toFixed(1) },
    { label: await t("row.dogs"), key: "dogsPerWeek", fmt: (n) => n.toFixed(1) },
    { label: await t("row.chips"), key: "chipsPerBet", fmt: (n) => String(n) },
    { label: await t("row.net"), key: "netPer100", fmt: (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0") },
  ];

  let hintText: string | null = null;
  if (meIsTop) hintText = await t("hint.top", { n: topSize });
  else if (hint?.metric === "crowdPct")
    hintText = await t(hint.top > hint.me ? "hint.crowd_more" : "hint.crowd_less", { top: hint.top, me: hint.me });
  else if (hint?.metric === "gamesPerWeek") hintText = await t("hint.games", { top: hint.top.toFixed(1), me: hint.me.toFixed(1) });
  else if (hint?.metric === "dogsPerWeek") hintText = await t("hint.dogs", { top: hint.top.toFixed(1), me: hint.me.toFixed(1) });
  else if (hint?.metric === "chipsPerBet") hintText = await t("hint.chips", { top: hint.top, me: hint.me });

  // How to win, for everyone (D-116): the top group's habits as one plain sentence, in
  // whole numbers a player can actually do. Same line for every reader — it is a
  // summary of the Top column, not advice aimed at anyone.
  const games = Math.max(1, Math.round(top.gamesPerWeek));
  const dogs = Math.round(top.dogsPerWeek);
  const recipe = await t("recipe", {
    n: topSize,
    games,
    dogs: dogs === 1 ? await t("recipe.dog_one") : await t("recipe.dogs", { dogs }),
    chips: top.chipsPerBet,
  });

  const [name, blurb, youLabel, topLabel, leagueLabel, note] = await Promise.all([
    t(`name.${style}`),
    t(`desc.${style}`),
    t("you"),
    t("top", { n: topSize }),
    t("league"),
    t("note", { n: topSize }),
  ]);

  return (
    <section aria-label={heading} className="panel">
      <h2 className="panel-head px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-heading)]">
        {heading}
      </h2>
      <div className="px-4 pb-1 pt-4">
        <p className="font-[family-name:var(--font-display)] text-lg font-bold uppercase tracking-[0.08em] text-[color:var(--color-gold)]">
          {name}
        </p>
        <p className="mt-1 text-sm text-[color:var(--color-text-mid)]">{blurb}</p>
      </div>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b border-[color:var(--color-border)]">
            <th className="px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-low)]" />
            <th className="w-12 px-1.5 py-1.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-low)]">{youLabel}</th>
            <th className="w-12 px-1.5 py-1.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-low)]">{topLabel}</th>
            <th className="w-12 py-1.5 pl-1.5 pr-4 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-low)]">{leagueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-[color:var(--color-border)] last:border-b-0">
              <td className="px-4 py-1.5 text-[color:var(--color-text-mid)]">{r.label}</td>
              <td className="nums px-1.5 py-1.5 text-right font-semibold text-[color:var(--color-text-hi)]">{r.fmt(me[r.key])}</td>
              <td className="nums px-1.5 py-1.5 text-right text-[color:var(--color-text-mid)]">{r.fmt(top[r.key])}</td>
              <td className="nums py-1.5 pl-1.5 pr-4 text-right text-[color:var(--color-text-low)]">{r.fmt(league[r.key])}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {hintText && <p className="border-t border-[color:var(--color-border)] px-4 pt-3 text-sm text-[color:var(--color-text-hi)]">{hintText}</p>}
      <p className={`px-4 pb-3 text-sm font-semibold text-[color:var(--color-gold)] ${hintText ? "pt-2" : "border-t border-[color:var(--color-border)] pt-3"}`}>
        {recipe}
      </p>
      <p className="px-4 pb-3 text-[11px] text-[color:var(--color-text-low)]">{note}</p>
    </section>
  );
}
