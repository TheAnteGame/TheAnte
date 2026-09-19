import { DateTime } from "luxon";
import { getCommissioner } from "@/lib/admin";
import { LEAGUE_TZ } from "@/lib/time";
import { AdminForm } from "@/components/admin/AdminForm";
import { Section, inputCls, thCls, tdCls } from "@/components/admin/ui";
import { phaseOf, tally } from "@/lib/polls/tally";
import { closePoll, createPoll } from "../actions";

// League polls (D-095). Create one here; it appears in Table Talk when it opens,
// the league is emailed at open and six hours before close, and the tally below
// shows names — the one place names are ever attached to votes.

export const dynamic = "force-dynamic";

export default async function PollsAdmin() {
  const ctx = (await getCommissioner())!;
  const db = ctx.db;
  const [{ data: polls }, { data: votes }, { data: players }] = await Promise.all([
    db.from("polls").select("id, question, options, opens_at, closes_at, closed_at, opened_notified_at, reminder_notified_at").order("created_at", { ascending: false }).limit(30),
    db.from("poll_votes").select("poll_id, player_id, option_index, via, voted_at"),
    db.from("players").select("id, first_name, last_name"),
  ]);
  const nameOf = new Map((players ?? []).map((p) => [p.id, `${p.first_name ?? ""} ${(p.last_name ?? "").slice(0, 1)}.`.trim()]));
  const fmt = (iso: string | null) => (iso ? DateTime.fromISO(iso).setZone(LEAGUE_TZ).toFormat("ccc LLL d, h:mma") : "—");

  return (
    <div className="flex flex-col gap-8">
      <Section title="New poll">
        <p className="mb-4 text-sm text-[color:var(--color-text-mid)]">
          Two to six options, one per line. Leave the open time blank to open now. The league is emailed when it
          opens and again six hours before it closes; each email button is a one-tap vote. Times are MST.
        </p>
        <AdminForm action={createPoll} submitLabel="Create poll">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-low)]">Question</span>
            <input name="question" required maxLength={160} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-low)]">Options, one per line</span>
            <textarea name="options" required rows={4} className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-low)]">Opens (blank = now)</span>
              <input name="opensAt" type="datetime-local" className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-low)]">Closes</span>
              <input name="closesAt" type="datetime-local" required className={inputCls} />
            </label>
          </div>
        </AdminForm>
      </Section>

      <Section title="Polls">
        {(polls ?? []).length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-low)]">No polls yet.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {(polls ?? []).map((p) => {
              const options = p.options as string[];
              const mine = (votes ?? []).filter((v) => v.poll_id === p.id);
              const t = tally(mine, options.length);
              const phase = phaseOf(p);
              return (
                <div key={p.id} className="border border-[color:var(--color-border)] p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-[color:var(--color-text-hi)]">{p.question}</p>
                    <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-low)]">{phase}</span>
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--color-text-low)]">
                    Opens {fmt(p.opens_at)} · Closes {fmt(p.closes_at)} · Open mail {p.opened_notified_at ? "sent" : "pending"} · Reminder{" "}
                    {p.reminder_notified_at ? "sent" : "pending"} · {t.total} votes
                  </p>
                  <table className="mt-3 w-full">
                    <thead>
                      <tr className="border-b border-[color:var(--color-border)]">
                        <th className={thCls}>Option</th>
                        <th className={thCls}>Votes</th>
                        <th className={thCls}>%</th>
                        <th className={thCls}>Who</th>
                      </tr>
                    </thead>
                    <tbody>
                      {options.map((label, i) => (
                        <tr key={i} className="border-b border-[color:var(--color-border)] align-top last:border-b-0">
                          <td className={`${tdCls} text-[color:var(--color-text-hi)]`}>{label}</td>
                          <td className={`${tdCls} nums`}>{t.counts[i]}</td>
                          <td className={`${tdCls} nums`}>{t.percents[i]}%</td>
                          <td className={`${tdCls} text-xs text-[color:var(--color-text-mid)]`}>
                            {mine
                              .filter((v) => v.option_index === i)
                              .map((v) => `${nameOf.get(v.player_id) ?? "?"}${v.via === "email" ? " (email)" : ""}`)
                              .join(", ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {phase === "open" && (
                    <div className="mt-3">
                      <AdminForm action={closePoll} submitLabel="Close now" danger inline confirmText="Close this poll now? Votes stop and the room sees the result.">
                        <input type="hidden" name="pollId" value={p.id} />
                      </AdminForm>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
