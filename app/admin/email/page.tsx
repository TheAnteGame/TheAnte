import { DateTime } from "luxon";
import { getCommissioner } from "@/lib/admin";
import { ET } from "@/lib/time";
import { AdminForm } from "@/components/admin/AdminForm";
import { BroadcastComposer } from "@/components/admin/BroadcastComposer";
import { Section, inputCls, thCls, tdCls } from "@/components/admin/ui";
import { cancelBroadcast, createBroadcast, previewBroadcast, sendTestBroadcast } from "../actions";

// One-off league emails (D-088). The scheduled funnel covers the season; this is
// the commissioner's own word to the room — an app update, a mea culpa for a bug, a
// reminder outside the calendar. Same envelope as every other email, previewed as
// the real rendering, sent now or at a chosen ET time by the broadcast.send cron.

export const dynamic = "force-dynamic";

export default async function EmailAdmin() {
  const ctx = (await getCommissioner())!;
  const db = ctx.db;
  const [{ count }, { data: rows }] = await Promise.all([
    db.from("players").select("id", { count: "exact", head: true }).eq("status", "approved").not("email", "is", null),
    db
      .from("broadcasts")
      .select("id, subject, send_at, status, sent_count, error, created_at")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  const fmt = (iso: string) => DateTime.fromISO(iso).setZone(ET).toFormat("ccc LLL d, h:mma");

  return (
    <div className="flex flex-col gap-8">
      <Section title="New league email">
        <p className="mb-4 text-sm text-[color:var(--color-text-mid)]">
          Goes to every approved player with an email on file ({count ?? 0} right now), in the same envelope as
          every other ANTE email. Blank lines make paragraphs. Preview shows the real rendering; Send test puts one
          copy in your own inbox first. Times are Eastern.
        </p>
        <BroadcastComposer
          create={createBroadcast}
          preview={previewBroadcast}
          test={sendTestBroadcast}
          inputCls={inputCls}
          playerCount={count ?? 0}
          labels={{
            subject: "Subject",
            headline: "Headline (defaults to the subject)",
            body: "Body",
            ctaLabel: "Button label (optional)",
            ctaHref: "Button link",
            whenNow: "Send now",
            whenLater: "Schedule",
            sendAt: "Send at (ET)",
            preview: "Preview",
            test: "Send test to me",
            submitNow: "Send to the league",
            submitLater: "Queue it",
          }}
        />
      </Section>

      <Section title="Sent and scheduled">
        {(rows ?? []).length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-low)]">Nothing yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-[color:var(--color-border)]">
                  <th className={thCls}>Send at</th>
                  <th className={thCls}>Subject</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Recipients</th>
                  <th className={thCls}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-[color:var(--color-border)] align-top last:border-b-0">
                    <td className={`${tdCls} whitespace-nowrap`}>{fmt(r.send_at)}</td>
                    <td className={`${tdCls} text-[color:var(--color-text-hi)]`}>{r.subject}</td>
                    <td className={tdCls}>
                      {r.status}
                      {r.error ? <span className="block text-xs text-[color:var(--color-loss)]">{r.error}</span> : null}
                    </td>
                    <td className={`${tdCls} nums`}>{r.status === "sent" ? r.sent_count : "—"}</td>
                    <td className={tdCls}>
                      {r.status === "queued" && (
                        <AdminForm action={cancelBroadcast} submitLabel="Cancel" danger inline confirmText="Cancel this email before it sends?">
                          <input type="hidden" name="broadcastId" value={r.id} />
                        </AdminForm>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
