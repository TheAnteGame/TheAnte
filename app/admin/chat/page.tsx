import { DateTime } from "luxon";
import { getCommissioner } from "@/lib/admin";
import { ET } from "@/lib/time";
import { AdminForm } from "@/components/admin/AdminForm";
import { Section, inputCls, thCls, tdCls } from "@/components/admin/ui";
import { hideChatMessage } from "../actions";

// Table Talk, from the commissioner's side (ANTE-ADMIN §4.3 "Message moderation").
// Muting stops the next message; this page deals with the one already posted.
// Hiding is a soft delete: the row and its body survive here and in the audit log,
// and the room simply stops showing the message — no tombstone, no notice (D-080). There is no hard
// delete of chat — the record of what happened is what makes the authority
// trustworthy. Muting itself stays on the Players page.

export const dynamic = "force-dynamic";

const PAGE = 100;

export default async function ChatAdmin() {
  const ctx = (await getCommissioner())!;
  const db = ctx.db;

  const [{ data: messages }, { data: players }] = await Promise.all([
    db
      .from("chat_messages")
      .select("id, player_id, body, hidden_at, hidden_by, hidden_reason, created_at")
      .eq("is_system", false)
      .order("created_at", { ascending: false })
      .limit(PAGE),
    db.from("players").select("id, first_name, last_name, is_muted, muted_until"),
  ]);

  const byId = new Map((players ?? []).map((p) => [p.id, p]));
  const nameOf = (id: string | null) => {
    const p = id ? byId.get(id) : null;
    if (!p) return "—";
    return `${p.first_name ?? ""} ${(p.last_name ?? "").slice(0, 1)}${p.last_name ? "." : ""}`.trim() || "—";
  };
  const mutedNow = (id: string | null) => {
    const p = id ? byId.get(id) : null;
    return !!p?.is_muted && (!p.muted_until || new Date(p.muted_until) > new Date());
  };

  const visible = (messages ?? []).filter((m) => !m.hidden_at).length;
  const hidden = (messages ?? []).length - visible;

  return (
    <div className="flex flex-col gap-8">
      <Section title="Table Talk">
        <p className="mb-4 text-sm text-[color:var(--color-text-mid)]">
          The last {PAGE} player messages, newest first. Hiding one removes it from the room with no notice to
          players — the body stays in the record here and the audit log names who hid it and why. Nothing here is ever
          deleted, and nothing here touches betting. To stop a player&rsquo;s <em>next</em> message, mute them from
          the Players page.
        </p>
        <p className="mb-4 text-xs uppercase tracking-wider text-[color:var(--color-text-low)]">
          {visible} showing · {hidden} hidden
        </p>

        {(messages ?? []).length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-low)]">Nobody has said anything yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-[color:var(--color-border)]">
                  <th className={thCls}>When</th>
                  <th className={thCls}>Who</th>
                  <th className={thCls}>Message</th>
                  <th className={thCls}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(messages ?? []).map((m) => {
                  const isHidden = !!m.hidden_at;
                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-[color:var(--color-border)] align-top last:border-b-0 ${
                        isHidden ? "opacity-60" : ""
                      }`}
                    >
                      <td className={`${tdCls} whitespace-nowrap text-xs text-[color:var(--color-text-low)]`}>
                        {DateTime.fromISO(m.created_at).setZone(ET).toFormat("LLL d, h:mma")}
                      </td>
                      <td className={`${tdCls} whitespace-nowrap text-[color:var(--color-text-hi)]`}>
                        {nameOf(m.player_id)}
                        {mutedNow(m.player_id) && (
                          <span className="ml-2 text-[12px] uppercase text-[color:var(--color-gold)]">muted</span>
                        )}
                      </td>
                      <td className={`${tdCls} max-w-[32rem] whitespace-pre-wrap break-words`}>
                        <span className={isHidden ? "line-through" : ""}>{m.body}</span>
                        {isHidden && (
                          <span className="mt-1 block text-xs italic text-[color:var(--color-text-low)]">
                            Hidden {DateTime.fromISO(m.hidden_at!).setZone(ET).toFormat("LLL d, h:mma")} by{" "}
                            {nameOf(m.hidden_by)}
                            {m.hidden_reason ? ` — ${m.hidden_reason}` : ""}
                          </span>
                        )}
                      </td>
                      <td className={tdCls}>
                        {isHidden ? (
                          <span className="text-xs uppercase text-[color:var(--color-text-low)]">hidden</span>
                        ) : (
                          <AdminForm
                            action={hideChatMessage}
                            submitLabel="Hide"
                            danger
                            inline
                            confirmText="Remove this message from the room? Players are not told. The body stays in the record and the audit log names you. This cannot be undone from here."
                          >
                            <input type="hidden" name="messageId" value={m.id} />
                            <input
                              name="reason"
                              placeholder="reason (required)"
                              required
                              className={`${inputCls} w-44`}
                              aria-label="Reason"
                            />
                          </AdminForm>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
