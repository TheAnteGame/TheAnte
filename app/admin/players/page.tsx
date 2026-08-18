import { DateTime } from "luxon";
import { getCommissioner } from "@/lib/admin";
import { fetchAllRows } from "@/lib/db/fetchAll";
import { ET } from "@/lib/time";
import { AdminForm } from "@/components/admin/AdminForm";
import {
  approvePlayer,
  deactivatePlayer,
  mutePlayer,
  reactivatePlayer,
  rejectPlayer,
  savePlayerNotes,
  unmutePlayer,
} from "../actions";
import { Section, inputCls, thCls, tdCls } from "@/components/admin/ui";

// The CRM (ANTE-ADMIN §4.3). Deactivation is the one action with real friction:
// two required fields, and the evidence must be the quotable thing the player
// actually said — a deactivation moves everyone's house limit via the median.

export const dynamic = "force-dynamic";

export default async function Players() {
  const ctx = (await getCommissioner())!;
  const db = ctx.db;

  const [{ data: players }, { data: season }, { data: stacks }, { data: tickets }] = await Promise.all([
    db.from("players").select("*").order("applied_at"),
    db.from("seasons").select("week1_lock_at").order("year", { ascending: false }).limit(1).maybeSingle(),
    fetchAllRows<{ player_id: string | null; amount: number }>((f, t) =>
      db.from("ledger_entries").select("player_id, amount").order("id").range(f, t),
    ).then((rows) => ({ data: rows })),
    db.from("tickets").select("player_id, submitted_at").order("submitted_at", { ascending: false }),
  ]);

  const stackOf = (id: string) =>
    (stacks ?? []).filter((e) => e.player_id === id).reduce((s, e) => s + e.amount, 0);
  const lastSubmit = (id: string) => (tickets ?? []).find((t) => t.player_id === id)?.submitted_at ?? null;

  const admissionOpen = !season?.week1_lock_at || new Date(season.week1_lock_at) > new Date();
  const pending = (players ?? []).filter((p) => p.status === "pending");
  const roster = (players ?? []).filter((p) => p.status !== "pending" && p.status !== "rejected");
  const approvedCount = roster.filter((p) => p.status === "approved").length;

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">Players</h1>

      <Section title={`Applications — ${pending.length} pending · ${approvedCount} approved of 8 minimum${admissionOpen ? "" : " · ROSTER LOCKED"}`}>
        {pending.length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-mid)]">
            {admissionOpen ? "Nobody is waiting." : "Admission closed at the Week 1 deadline (§13). This tab is history now."}
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-[color:var(--color-text-hi)]">
                  {p.first_name ?? "—"} {p.last_name ?? ""} · {p.email ?? "no email"} · {p.favorite_team ?? "—"} ·
                  applied {DateTime.fromISO(p.applied_at).setZone(ET).toRelative()}
                </span>
                {admissionOpen && (
                  <>
                    <AdminForm action={approvePlayer} submitLabel="Approve" inline confirmText="Approve — this credits the 500-chip buy-in. This is the moment a player exists.">
                      <input type="hidden" name="playerId" value={p.id} />
                    </AdminForm>
                    <AdminForm action={rejectPlayer} submitLabel="Reject" danger inline>
                      <input type="hidden" name="playerId" value={p.id} />
                      <input name="reason" placeholder="reason" className={`${inputCls} w-40`} aria-label="Reason" />
                    </AdminForm>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Roster">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-[color:var(--color-border)]">
                <th className={thCls}>Player</th>
                <th className={thCls}>Contact</th>
                <th className={thCls}>Team</th>
                <th className={thCls}>Stack</th>
                <th className={thCls}>Shove</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Last submitted</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => (
                <tr key={p.id} className="border-b border-[color:var(--color-border)] align-top last:border-b-0">
                  <td className={`${tdCls} text-[color:var(--color-text-hi)]`}>
                    {p.first_name} {p.last_name}
                    {p.is_muted && <span className="ml-2 text-[10px] uppercase text-[color:var(--color-gold)]">muted</span>}
                  </td>
                  <td className={tdCls}>
                    {p.email ?? "—"}
                    <br />
                    <span className="text-[color:var(--color-text-low)]">{p.phone ?? ""}</span>
                  </td>
                  <td className={tdCls}>{p.favorite_team ?? "—"}</td>
                  <td className={`${tdCls} nums`}>{stackOf(p.id)}</td>
                  <td className={tdCls}>{p.shove_used_week === null ? "held" : `Wk ${p.shove_used_week}`}</td>
                  <td className={tdCls}>{p.status}</td>
                  <td className={`${tdCls} text-xs text-[color:var(--color-text-low)]`}>
                    {lastSubmit(p.id) ? DateTime.fromISO(lastSubmit(p.id)!).setZone(ET).toFormat("ccc h:mma") : "never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-[color:var(--color-text-mid)]">Moderation & roster actions</summary>
          <div className="mt-4 flex flex-col gap-6">
            {roster.map((p) => (
              <div key={p.id} className="border border-[color:var(--color-border)] p-3">
                <p className="mb-3 text-sm font-semibold text-[color:var(--color-text-hi)]">
                  {p.first_name} {p.last_name} — {p.status}
                </p>
                <div className="flex flex-wrap gap-4">
                  {p.status === "approved" && !p.is_muted && (
                    <AdminForm action={mutePlayer} submitLabel="Mute" inline>
                      <input type="hidden" name="playerId" value={p.id} />
                      <input name="reason" placeholder="reason (required, public)" required className={`${inputCls} w-48`} aria-label="Reason" />
                      <select name="hours" className={inputCls} aria-label="Duration">
                        <option value="1">1h</option>
                        <option value="24">24h</option>
                        <option value="168">7d</option>
                        <option value="0">until lifted</option>
                      </select>
                    </AdminForm>
                  )}
                  {p.is_muted && (
                    <AdminForm action={unmutePlayer} submitLabel="Unmute" inline>
                      <input type="hidden" name="playerId" value={p.id} />
                    </AdminForm>
                  )}
                  {p.status === "approved" && (
                    <AdminForm
                      action={deactivatePlayer}
                      submitLabel="Deactivate"
                      danger
                      confirmText={`Deactivate ${p.first_name}? They stop paying antes at the next slate open, leave the median (moving every limit in the league), keep their stack and standings row, and forfeit the championship and every award. Reversible. Silence is NEVER grounds — they must have said they're done.`}
                      inline
                    >
                      <input type="hidden" name="playerId" value={p.id} />
                      <input name="reason" placeholder="your rationale (required)" required className={`${inputCls} w-44`} aria-label="Reason" />
                      <input name="evidence" placeholder='the quotable thing they said (required)' required className={`${inputCls} w-56`} aria-label="Evidence" />
                    </AdminForm>
                  )}
                  {p.status === "deactivated" && (
                    <AdminForm action={reactivatePlayer} submitLabel="Reactivate" inline>
                      <input type="hidden" name="playerId" value={p.id} />
                    </AdminForm>
                  )}
                  <AdminForm action={savePlayerNotes} submitLabel="Save notes" inline>
                    <input type="hidden" name="playerId" value={p.id} />
                    <input name="notes" defaultValue={p.notes ?? ""} placeholder="commissioner-private notes" className={`${inputCls} w-64`} aria-label="Notes" />
                  </AdminForm>
                </div>
              </div>
            ))}
          </div>
        </details>
      </Section>
    </div>
  );
}
