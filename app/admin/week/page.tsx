import { DateTime } from "luxon";
import { getCommissioner } from "@/lib/admin";
import { ET } from "@/lib/time";
import { AdminForm } from "@/components/admin/AdminForm";
import { correctGame, forceReveal, resettle, runSettlement } from "../actions";
import { Section, inputCls, thCls, tdCls } from "@/components/admin/ui";

// Week control (ANTE-ADMIN §4.2). Manual overrides are the ONLY game-data writes
// permitted; each demands a reason, writes audit, and mirrors publicly. Shoves and
// the Pot do not appear here pre-reveal — the commissioner sees what players see.

export const dynamic = "force-dynamic";

export default async function WeekControl() {
  const ctx = (await getCommissioner())!;
  const db = ctx.db;

  const { data: week } = await db
    .from("weeks")
    .select("*")
    .in("phase", ["open", "revealed", "settled"])
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!week) {
    return (
      <div>
        <h1 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">Week control</h1>
        <p className="text-sm text-[color:var(--color-text-mid)]">No week yet. slate.open creates Week 1 once the season is active.</p>
      </div>
    );
  }

  const { data: games } = await db.from("games").select("*").eq("week_id", week.id).order("kickoff_at");
  const pastDeadline = new Date() >= new Date(week.deadline_at);

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">
        Week {week.number} — {week.phase}
      </h1>

      <Section title={`Slate — ${(games ?? []).filter((g) => g.on_slate).length} on, ${(games ?? []).filter((g) => !g.on_slate).length} off`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-[color:var(--color-border)]">
                <th className={thCls}>Kickoff (ET)</th>
                <th className={thCls}>Game</th>
                <th className={thCls}>Spread</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Score</th>
                <th className={thCls}>Override</th>
              </tr>
            </thead>
            <tbody>
              {(games ?? []).map((g) => (
                <tr key={g.id} className={`border-b border-[color:var(--color-border)] last:border-b-0 ${!g.on_slate ? "opacity-40 line-through" : ""}`}>
                  <td className={`${tdCls} nums`}>{DateTime.fromISO(g.kickoff_at).setZone(ET).toFormat("ccc h:mma")}</td>
                  <td className={tdCls}>
                    {g.away_team} @ {g.home_team}
                    {!g.on_slate && <span className="ml-2 text-[12px] uppercase no-underline">off-slate</span>}
                    {g.void_reason && <span className="ml-2 text-[12px] uppercase text-[color:var(--color-gold)]">{g.void_reason}</span>}
                  </td>
                  <td className={`${tdCls} nums`}>{g.spread_frozen ?? "—"}</td>
                  <td className={tdCls}>{g.status}</td>
                  <td className={`${tdCls} nums`}>{g.away_score ?? "—"}–{g.home_score ?? "—"}</td>
                  <td className={tdCls}>
                    {g.on_slate && !g.settled && (
                      <AdminForm action={correctGame} submitLabel="Apply" inline>
                        <input type="hidden" name="gameId" value={g.id} />
                        <select name="op" className={inputCls} aria-label="Operation">
                          <option value="score">Correct score</option>
                          <option value="cancel">Cancel</option>
                          <option value="postpone">Postpone past settlement</option>
                          <option value="void_pre_deadline">Void — kicked pre-deadline (§10)</option>
                          <option value="unfinal">Un-mark false final</option>
                        </select>
                        <input name="awayScore" placeholder="away" className={`${inputCls} nums w-16`} aria-label="Away score" />
                        <input name="homeScore" placeholder="home" className={`${inputCls} nums w-16`} aria-label="Home score" />
                        <input name="reason" placeholder="reason (required, public)" required className={`${inputCls} w-52`} aria-label="Reason" />
                      </AdminForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {week.phase === "open" && (
        <Section title="Reveal">
          <p className="mb-3 text-sm text-[color:var(--color-text-mid)]">
            Fires automatically when the last ticket lands, or Thursday noon. Force is settlement-job recovery only —
            {pastDeadline ? " the deadline has passed." : " disabled until the deadline passes (an early reveal hands the room to everyone unsubmitted)."}
          </p>
          <AdminForm
            action={forceReveal}
            submitLabel="Force reveal"
            danger
            confirmText="Force the reveal? Non-submitters are folded. This cannot be undone."
            inline
          >
            <input name="reason" placeholder="typed reason (required)" required className={`${inputCls} w-64`} aria-label="Reason" />
          </AdminForm>
        </Section>
      )}

      {week.phase === "revealed" && (
        <Section title="Settlement">
          <p className="mb-3 text-sm text-[color:var(--color-text-mid)]">
            Runs automatically when the last on-slate game goes final. Manual run is idempotent; a conservation
            failure halts the week loudly rather than writing bad state (§8.12).
          </p>
          <AdminForm action={runSettlement} submitLabel="Run settlement now" inline />
        </Section>
      )}

      {week.phase === "settled" && (
        <Section title="Settled">
          <p className="mb-4 text-sm text-[color:var(--color-text-mid)]">
            Settled {week.settled_at ? DateTime.fromISO(week.settled_at).setZone(ET).toFormat("ccc h:mma 'ET'") : ""} — swept {week.pot_swept ?? 0},
            awarded {week.pot_awarded ?? 0}{week.marker > 0 ? `, marker ${week.marker}` : ""}.
          </p>
          <p className="mb-2 text-sm text-[color:var(--color-text-mid)]">
            Re-settlement reverses every entry visibly and replays this week and every later week in order.
            Locked tickets settle exactly as submitted — the §9 floor absorbs any overdraft. It posts to Table Talk.
          </p>
          <AdminForm
            action={resettle}
            submitLabel="Re-settle cascade"
            danger
            confirmText="Re-settle? Every entry from the chosen week forward is reversed (visibly, nothing deleted) and replayed. This posts publicly."
            inline
          >
            <input name="weekNumber" type="number" min={1} max={18} defaultValue={week.number} className={`${inputCls} nums w-20`} aria-label="From week" />
            <input name="reason" placeholder="reason (required, public)" required className={`${inputCls} w-64`} aria-label="Reason" />
          </AdminForm>
        </Section>
      )}
    </div>
  );
}
