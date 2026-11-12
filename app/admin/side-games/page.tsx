import { notFound } from "next/navigation";
import { getCommissioner } from "@/lib/admin";
import { getContent } from "@/lib/content/getContent";
import { fetchPlayResults, playResultsUrl, previewSideGames, type SideGamePreview } from "@/lib/jobs/sideGames";
import { SIDE_GAMES_LAST_WEEK, type SideGameRow } from "@/lib/engine";
import { AdminForm } from "@/components/admin/AdminForm";
import { postSideGameResults } from "../actions";
import { Section, Stat, inputCls, thCls, tdCls } from "@/components/admin/ui";

// Side games (D-132): ANTE Play decides who won; this page shows exactly what Ante
// would move for it — every row, the pools and the house before and after — and the
// one button that writes it. Hidden entirely when ANTE_PLAY_RESULTS_URL is unset.

export const dynamic = "force-dynamic";

const MODE: Record<string, string> = {
  none: "No eligible entrants — nothing moves",
  contested: "Contested — winners split the pool",
  solo_win: "Solo — beat the house",
  solo_loss: "Solo — lost to the house",
  no_contest: "One left after drops — no contest, nothing taken",
};

export default async function SideGames({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  if (!playResultsUrl()) notFound();
  const ctx = (await getCommissioner())!;
  const db = ctx.db;
  const sp = await searchParams;

  const { data: season } = await db.from("seasons").select("id, year").order("year", { ascending: false }).limit(1).maybeSingle();
  const { data: lastSettled } = season
    ? await db
        .from("weeks")
        .select("number")
        .eq("season_id", season.id)
        .not("settled_at", "is", null)
        .order("number", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const asked = Number(sp.week);
  const week = Number.isInteger(asked) && asked >= 1 && asked <= SIDE_GAMES_LAST_WEEK ? asked : (lastSettled?.number ?? null);

  const [entryLabel, winLabel, houseLabel] = await Promise.all([
    getContent("player.parts_play_entry"),
    getContent("player.parts_play_payout"),
    getContent("player.parts_play_house"),
  ]);
  const kindLabel: Record<SideGameRow["kind"], string> = { play_entry: entryLabel, play_payout: winLabel, play_house: houseLabel };

  let preview: SideGamePreview | null = null;
  let fetchError: string | null = null;
  if (season && week) {
    try {
      preview = await previewSideGames(db, await fetchPlayResults(season.year, week));
    } catch (e) {
      fetchError = e instanceof Error ? e.message : String(e);
    }
  }

  const who = (id: string | null, account: string | null) =>
    id ? (preview?.names[id] ?? id.slice(0, 8)) : account === "play_house" ? "House" : account === "play_pool_bingo" ? "Bingo pool" : "Crunch Time pool";
  const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const anyUnposted = !!preview && preview.blockers.length === 0 && preview.rows.length > 0;

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-heading)]">
        Side games{week ? ` — Week ${week}` : ""}
      </h1>

      <form method="get" className="mb-4 flex items-center gap-2 text-sm">
        <label htmlFor="sg-week" className="text-[color:var(--color-text-mid)]">Week</label>
        <input id="sg-week" name="week" defaultValue={week ?? ""} className={`${inputCls} nums w-16`} />
        <button type="submit" className="btn-chrome chamfer px-3 py-1.5 text-xs font-semibold uppercase tracking-wide">Load</button>
        <span className="text-[color:var(--color-text-low)]">Results from {playResultsUrl()}</span>
      </form>

      {!week && <p className="text-sm text-[color:var(--color-text-mid)]">No week has settled yet. Side games post after Ante settles the week.</p>}
      {fetchError && (
        <Section title="Could not read ANTE Play">
          <p className="text-sm text-[color:var(--color-loss)]">{fetchError}</p>
        </Section>
      )}

      {preview && (
        <>
          {preview.blockers.length > 0 && (
            <Section title="Not ready to post">
              <ul className="list-disc pl-5 text-sm text-[color:var(--color-loss)]">
                {preview.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Accounts — before → after this post">
            <div className="flex flex-wrap gap-8">
              <Stat label="House" value={`${preview.before.play_house} → ${preview.after.play_house}`} accent={preview.after.play_house < 0 ? "loss" : undefined} />
              <Stat label="Bingo pool" value={`${preview.before.play_pool_bingo} → ${preview.after.play_pool_bingo}`} />
              <Stat label="Crunch Time pool" value={`${preview.before.play_pool_crunch} → ${preview.after.play_pool_crunch}`} />
            </div>
            <p className="mt-3 text-[12px] text-[color:var(--color-text-low)]">
              None of these is the Pot. The house may go negative (D-131 rule 6); a pool never does. Week {SIDE_GAMES_LAST_WEEK} sweeps what is left in each pool to the house.
            </p>
          </Section>

          {preview.games.map((g) => (
            <Section key={g.game} title={`${g.name}${g.posted ? " — POSTED" : ""}`}>
              {g.posted ? (
                <p className="text-sm text-[color:var(--color-win)]">Already on the ledger for Week {preview!.week}. A repeat is refused by the ledger&apos;s own idempotency keys.</p>
              ) : !g.plan ? (
                <p className="text-sm text-[color:var(--color-text-mid)]">No plan — see above.</p>
              ) : (
                <div className="flex flex-col gap-3 text-sm">
                  <p className="text-[color:var(--color-text-mid)]">{MODE[g.plan.mode]}</p>
                  <div className="flex flex-wrap gap-8">
                    <Stat label="Entrants" value={g.plan.eligible.length} />
                    <Stat label="Dropped" value={g.plan.dropped.length} accent={g.plan.dropped.length ? "loss" : undefined} />
                    <Stat label="Pool before → after" value={`${g.plan.poolBefore} → ${g.plan.poolAfter}`} />
                    <Stat label="House" value={signed(g.plan.houseDelta)} />
                    {g.plan.mode === "contested" && <Stat label="Prize" value={g.plan.prize} accent="gold" />}
                    {g.plan.swept > 0 && <Stat label="Season sweep" value={g.plan.swept} />}
                  </div>
                  {g.plan.eligible.length > 0 && (
                    <p>
                      <span className="text-[color:var(--color-text-low)]">In: </span>
                      {g.plan.eligible.map((id) => who(id, null)).join(", ")}
                    </p>
                  )}
                  {g.plan.dropped.length > 0 && (
                    <p className="text-[color:var(--color-loss)]">
                      Dropped — stack can&apos;t cover the 10 (rule 9), entry cancelled, nothing taken: {g.plan.dropped.map((id) => who(id, null)).join(", ")}
                    </p>
                  )}
                  {g.plan.winners.length > 0 && (
                    <p>
                      <span className="text-[color:var(--color-text-low)]">{g.plan.winners.length > 1 ? "Tied winners" : "Winner"}: </span>
                      <span className="text-[color:var(--color-gold)]">{g.plan.winners.map((id) => who(id, null)).join(", ")}</span> — {g.plan.payoutEach} each
                    </p>
                  )}
                  {g.plan.rows.length > 0 && (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[color:var(--color-border)]">
                          <th className={thCls}>Account</th>
                          <th className={thCls}>Kind</th>
                          <th className={thCls}>Chips</th>
                          <th className={thCls}>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.plan.rows.map((r) => (
                          <tr key={`${r.idempotencyKey}:${r.playerId ?? r.account}`} className="border-b border-[color:var(--color-border)] last:border-b-0">
                            <td className={tdCls}>{who(r.playerId, r.account)}</td>
                            <td className={tdCls}>{kindLabel[r.kind]}</td>
                            <td className={`${tdCls} nums ${r.amount < 0 ? "text-[color:var(--color-loss)]" : "text-[color:var(--color-win)]"}`}>{signed(r.amount)}</td>
                            <td className={`${tdCls} text-[color:var(--color-text-low)]`}>{r.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </Section>
          ))}

          {anyUnposted && (
            <Section title="Post">
              <p className="mb-3 text-sm text-[color:var(--color-text-mid)]">
                Re-reads ANTE Play, checks the week is final and that Ante has settled it, then writes every row above in one
                insert and runs the conservation check over the whole ledger. Nothing is written unless every chip balances.
              </p>
              <AdminForm
                action={postSideGameResults}
                submitLabel="Post side-game results"
                confirmText={`Post Week ${preview.week}'s side-game results? ${preview.rows.length} ledger rows. The ledger is append-only — this cannot be undone.`}
                inline
              >
                <input type="hidden" name="week" value={preview.week} />
              </AdminForm>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
