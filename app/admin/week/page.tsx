import { DateTime } from "luxon";
import { getCommissioner } from "@/lib/admin";
import { LEAGUE_TZ } from "@/lib/time";
import { AdminForm } from "@/components/admin/AdminForm";
import { correctGame, forceReveal, openWeekEarly, recomputeWeekSnapshot, resettle, runSettlement } from "../actions";
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
    const { data: season } = await db.from("seasons").select("status").order("year", { ascending: false }).limit(1).maybeSingle();
    return (
      <div>
        <h1 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-heading)]">Week control</h1>
        <p className="text-sm text-[color:var(--color-text-mid)]">No week yet. slate.open creates Week 1 on its Tuesday once the season is active.</p>
        {season?.status === "active" ? (
          <Section title="Open the week early (D-035)">
            <p className="mb-3 text-sm text-[color:var(--color-text-mid)]">
              Opens the next week&apos;s board now instead of Tuesday 6:00am MST. The Thursday-noon deadline does not move,
              and while admission is open only the deadline reveals — early tickets stay sealed however few players are in.
            </p>
            <AdminForm
              action={openWeekEarly}
              submitLabel="Open the week now"
              confirmText="Open the next week's board immediately? The deadline stays Thursday noon. This cannot be un-opened."
              inline
            >
              <input name="reason" placeholder="typed reason (required)" required className={`${inputCls} w-64`} aria-label="Reason" />
            </AdminForm>
          </Section>
        ) : (
          <p className="mt-2 text-sm text-[color:var(--color-text-low)]">Activate the season first (Settings) — §1&apos;s eight-player floor applies.</p>
        )}
      </div>
    );
  }

  const { data: games } = await db.from("games").select("*").eq("week_id", week.id).order("kickoff_at");
  const pastDeadline = new Date() >= new Date(week.deadline_at);

  // This page is built around the NEWEST week, which hid the one button that mattered
  // on 2026-09-29: Week 3 was revealed and unsettled, Week 4 was open, so Week 3's
  // "Run settlement now" never rendered (D-110). An older week still unpaid is now
  // surfaced above everything else.
  const { data: unpaid } = await db
    .from("weeks")
    .select("number")
    .eq("phase", "revealed")
    .lt("number", week.number)
    .order("number", { ascending: true })
    .limit(1)
    .maybeSingle();
  const { data: lastSettled } = await db
    .from("weeks")
    .select("number")
    .eq("phase", "settled")
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-heading)]">
        Week {week.number} — {week.phase}
      </h1>

      {unpaid && (
        <Section title={`Week ${unpaid.number} is still unsettled`}>
          <p className="mb-3 text-sm text-[color:var(--color-loss)]">
            Week {unpaid.number} was revealed but never settled, so every stake in it is still out of its owner&apos;s stack
            and the standings are a projection. Settlement retries every five minutes on its own; run it now if you have
            fixed what stopped it. Nothing is written unless every chip balances.
          </p>
          <AdminForm action={runSettlement} submitLabel={`Settle Week ${unpaid.number} now`} inline />
        </Section>
      )}

      <Section title={`Slate — ${(games ?? []).filter((g) => g.on_slate).length} on, ${(games ?? []).filter((g) => !g.on_slate).length} off`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-[color:var(--color-border)]">
                <th className={thCls}>Kickoff (MST)</th>
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
                  <td className={`${tdCls} nums`}>{DateTime.fromISO(g.kickoff_at).setZone(LEAGUE_TZ).toFormat("ccc h:mma")}</td>
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

      {week.phase === "open" && (
        <Section title="Correct this week's opening figures">
          <p className="mb-3 text-sm text-[color:var(--color-text-mid)]">
            Recomputes the median, every house limit and the Pot figure from the stacks this week should have opened on —
            for a week that opened before the previous one settled. Moves no chips and touches no ticket: a ticket already
            in stands as submitted. Refuses if the antes already posted would differ. A backup is taken first; the before
            and after go to the audit log.
          </p>
          <AdminForm
            action={recomputeWeekSnapshot}
            submitLabel="Recompute figures"
            confirmText="Recompute this week's median, house limits and Pot figure from the settled stacks? No chips move."
            inline
          >
            <input name="reason" placeholder="typed reason (required)" required className={`${inputCls} w-64`} aria-label="Reason" />
          </AdminForm>
        </Section>
      )}

      {week.phase === "open" && lastSettled && !unpaid && (
        <Section title="Re-settle an earlier week">
          <p className="mb-2 text-sm text-[color:var(--color-text-mid)]">
            Reverses every settlement entry from the chosen week forward (visibly — nothing is deleted) and replays it under
            the current rules. This week is open, so it is not replayed: recompute its figures afterwards. It posts to
            Table Talk.
          </p>
          <AdminForm
            action={resettle}
            submitLabel="Re-settle cascade"
            danger
            confirmText="Re-settle? Every entry from the chosen week forward is reversed (visibly, nothing deleted) and replayed. This posts publicly."
            inline
          >
            <input name="weekNumber" type="number" min={1} max={18} defaultValue={lastSettled.number} className={`${inputCls} nums w-20`} aria-label="From week" />
            <input name="reason" placeholder="reason (required, public)" required className={`${inputCls} w-64`} aria-label="Reason" />
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
            Settled {week.settled_at ? DateTime.fromISO(week.settled_at).setZone(LEAGUE_TZ).toFormat("ccc h:mma 'MST'") : ""} — swept {week.pot_swept ?? 0},
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
