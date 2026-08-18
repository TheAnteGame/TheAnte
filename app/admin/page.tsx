import { DateTime } from "luxon";
import { getCommissioner } from "@/lib/admin";
import { fetchAllRows } from "@/lib/db/fetchAll";
import { createUserClient } from "@/lib/db/supabase";
import { tierForWeek } from "@/lib/engine";
import { ET } from "@/lib/time";
import { AdminForm } from "@/components/admin/AdminForm";
import { nudgePlayer } from "./actions";
import { Section, Stat } from "@/components/admin/ui";

// The ops dashboard — "is anything on fire" (ANTE-ADMIN §4.1). The submission
// tracker reads the SAME narrow view players see (§6): names only, never picks,
// never a shove indicator. The pre-reveal console is deliberately thin — the
// absence is the feature (art §7).

export const dynamic = "force-dynamic";

const JOB_KEYS = ["slate.open", "reveal.check", "reveal.deadline", "scores.sync", "settle.week", "feeds.sync", "schedule.refetch"];

export default async function Ops() {
  const ctx = (await getCommissioner())!;
  const db = ctx.db;

  const [{ data: week }, { data: potRows }, { data: runs }, { data: waiting }, { data: noEmail }] = await Promise.all([
    db
      .from("weeks")
      .select("*")
      .in("phase", ["open", "revealed", "settled"])
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    fetchAllRows<{ amount: number; player_id: string | null }>((f, t) =>
      db.from("ledger_entries").select("amount, player_id").is("player_id", null).order("id").range(f, t),
    ).then((rows) => ({ data: rows })),
    db.from("job_runs").select("job_key, status, started_at, detail").order("started_at", { ascending: false }).limit(200),
    // Names only — through the player-facing view, as the requesting user (§4.1).
    createUserClient().from("waiting_on").select("first_name, last_name, submitted"),
    db.from("players").select("id, first_name, last_name, email").eq("status", "approved").is("email", null),
  ]);

  const pot = (potRows ?? []).reduce((s, e) => s + e.amount, 0);

  const lastRun = new Map<string, { status: string; at: string }>();
  for (const r of runs ?? []) {
    if (!lastRun.has(r.job_key)) lastRun.set(r.job_key, { status: r.status, at: r.started_at });
  }
  const failures = (runs ?? []).filter((r) => r.status === "failed").slice(0, 5);

  let unsettledFinals = 0;
  let staleGames = 0;
  if (week) {
    const { data: games } = await db.from("games").select("status, settled, kickoff_at").eq("week_id", week.id);
    unsettledFinals = (games ?? []).filter((g) => g.status === "final" && !g.settled).length;
    staleGames = (games ?? []).filter(
      (g) => g.status !== "final" && new Date(g.kickoff_at).getTime() + 6 * 3600_000 < Date.now(),
    ).length;
  }

  const out = (waiting ?? []).filter((w) => !w.submitted);
  const waitingIds = new Map<string, string>();
  if (out.length > 0) {
    const { data: players } = await db.from("players").select("id, first_name, last_name").eq("status", "approved");
    for (const w of out) {
      const p = (players ?? []).find(
        (x) => x.first_name === w.first_name && x.last_name === w.last_name,
      );
      if (p) waitingIds.set(`${w.first_name} ${w.last_name}`, p.id);
    }
  }

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">Ops</h1>

      <Section title="Current week">
        {week ? (
          <div className="flex flex-wrap gap-8">
            <Stat label="Week" value={week.number} />
            <Stat label="Phase" value={week.phase} />
            <Stat label="Ante" value={`${week.ante} (${tierForWeek(week.number)})`} />
            <Stat label="Deadline" value={DateTime.fromISO(week.deadline_at).setZone(ET).toFormat("ccc h:mma 'ET'")} />
            <Stat label="Median" value={week.median_snapshot ?? "—"} />
            <Stat label="Places tier" value={`${week.places_tier_snapshot ?? "—"} (of ${week.active_count_snapshot ?? "—"})`} />
          </div>
        ) : (
          <p className="text-sm text-[color:var(--color-text-mid)]">Preseason. No week yet — slate.open creates Week 1 once the season is active.</p>
        )}
      </Section>

      <Section title="The Pot">
        <div className="flex items-center gap-8">
          <Stat label="Balance" value={pot} accent="gold" />
          {week && week.marker > 0 && (
            <p className="border border-[color:var(--color-gold-dim)] px-3 py-2 text-sm text-[color:var(--color-gold)]">
              The table is into the Pot for {week.marker} (Week {week.number}). Next week&apos;s antes pay it down first (§7).
            </p>
          )}
        </div>
      </Section>

      {week?.phase === "open" && (
        <Section title={`Submissions — ${(waiting ?? []).length - out.length} of ${(waiting ?? []).length} in`}>
          {out.length === 0 ? (
            <p className="text-sm text-[color:var(--color-text-mid)]">Everyone is in. The reveal fires itself.</p>
          ) : (
            <ul className="space-y-2">
              {out.map((w) => {
                const name = `${w.first_name ?? ""} ${w.last_name ?? ""}`.trim();
                const id = waitingIds.get(`${w.first_name} ${w.last_name}`);
                return (
                  <li key={name} className="flex items-center gap-3 text-sm">
                    <span className="text-[color:var(--color-text-hi)]">{name}</span>
                    {id && (
                      <AdminForm action={nudgePlayer} submitLabel="Nudge" inline>
                        <input type="hidden" name="playerId" value={id} />
                      </AdminForm>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}

      <Section title="Job health">
        <table className="w-full">
          <tbody>
            {JOB_KEYS.map((key) => {
              const run = lastRun.get(key);
              const age = run ? DateTime.fromISO(run.at).toRelative() : "never";
              return (
                <tr key={key} className="border-b border-[color:var(--color-border)] last:border-b-0">
                  <td className="py-1.5 text-sm text-[color:var(--color-text-hi)]">{key}</td>
                  <td className={`py-1.5 text-sm ${run?.status === "failed" ? "text-[color:var(--color-loss)]" : "text-[color:var(--color-text-mid)]"}`}>
                    {run?.status ?? "—"}
                  </td>
                  <td className="py-1.5 text-right text-xs text-[color:var(--color-text-low)]">{age}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title="Alerts">
        <ul className="space-y-1 text-sm">
          {failures.length === 0 && unsettledFinals === 0 && staleGames === 0 && (noEmail ?? []).length === 0 ? (
            <li className="text-[color:var(--color-text-mid)]">Nothing is on fire.</li>
          ) : (
            <>
              {failures.map((f, i) => (
                <li key={i} className="text-[color:var(--color-loss)]">
                  ✕ {f.job_key} failed {DateTime.fromISO(f.started_at).toRelative()}
                </li>
              ))}
              {unsettledFinals > 0 && <li className="text-[color:var(--color-gold)]">⚠ {unsettledFinals} final game(s) not yet settled</li>}
              {staleGames > 0 && <li className="text-[color:var(--color-gold)]">⚠ {staleGames} game(s) with no result 6h+ past kickoff</li>}
              {(noEmail ?? []).map((p) => (
                <li key={p.id} className="text-[color:var(--color-gold)]">
                  ⚠ {p.first_name} {p.last_name}: no email on file
                </li>
              ))}
            </>
          )}
        </ul>
      </Section>
    </div>
  );
}
