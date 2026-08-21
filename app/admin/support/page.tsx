import { DateTime } from "luxon";
import { getCommissioner } from "@/lib/admin";
import { ET } from "@/lib/time";
import { AdminForm } from "@/components/admin/AdminForm";
import { Section, inputCls } from "@/components/admin/ui";
import { replySupportMessage } from "../actions";

// The support desk (D-012). Players message from the dashboard, the commissioner is
// emailed that one is waiting, and the reply goes back out by email — the player was
// told that is where the answer arrives, so this is the only path that keeps that promise.
//
// Answered tickets stay on the page. Nothing in this product is ever deleted (§14).

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  body: string;
  created_at: string;
  status: string;
  reply: string | null;
  answered_at: string | null;
  players: { first_name: string | null; last_name: string | null; email: string | null } | Array<{ first_name: string | null; last_name: string | null; email: string | null }> | null;
}

export default async function Support() {
  const ctx = (await getCommissioner())!;

  const { data } = await ctx.db
    .from("support_messages")
    .select("id, body, created_at, status, reply, answered_at, players(first_name, last_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as Row[];
  const who = (r: Row) => {
    const p = Array.isArray(r.players) ? r.players[0] : r.players;
    const name = `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim();
    return { name: name || "—", email: p?.email ?? null };
  };

  const open = rows.filter((r) => r.status === "open");
  const answered = rows.filter((r) => r.status !== "open");

  const card = (r: Row) => {
    const p = who(r);
    return (
      <article key={r.id} className="border-b border-[color:var(--color-border)] px-4 py-4 last:border-b-0">
        <header className="mb-2 flex flex-wrap items-baseline gap-x-3">
          <span className="font-semibold text-[color:var(--color-text-hi)]">{p.name}</span>
          <span className="text-xs text-[color:var(--color-text-low)]">{p.email ?? "no email on file"}</span>
          <span className="nums ml-auto text-xs text-[color:var(--color-text-low)]">
            {DateTime.fromISO(r.created_at).setZone(ET).toFormat("LLL d, h:mma 'ET'")}
          </span>
        </header>

        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-text-hi)]">{r.body}</p>

        {r.status === "open" ? (
          <div className="mt-3">
            {p.email ? (
              <AdminForm action={replySupportMessage} submitLabel="Send reply">
                <input type="hidden" name="messageId" value={r.id} />
                <textarea
                  name="reply"
                  required
                  rows={4}
                  maxLength={4000}
                  placeholder="Your answer — this goes to their email."
                  className={`${inputCls} w-full resize-y leading-relaxed`}
                  aria-label="Reply"
                />
              </AdminForm>
            ) : (
              <p className="text-xs text-[color:var(--color-loss)]">
                No email on file for this player, so a reply cannot be sent. Ask them to add one on their profile.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3 border-l-2 border-[color:var(--color-gold-dim)] pl-3">
            <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-gold)]">
              Answered{" "}
              {r.answered_at && DateTime.fromISO(r.answered_at).setZone(ET).toFormat("LLL d, h:mma 'ET'")} — emailed
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-text-mid)]">{r.reply}</p>
          </div>
        )}
      </article>
    );
  };

  return (
    <div>
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">Support</h1>
      <p className="mb-4 max-w-3xl text-xs text-[color:var(--color-text-low)]">
        Messages players send from the dashboard. You are emailed when one arrives; your reply is emailed back to them,
        which is what the confirmation promised. Answered messages stay here — nothing is deleted.
      </p>

      <Section title={`Waiting on you (${open.length})`}>
        {open.length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-mid)]">Nothing waiting.</p>
        ) : (
          <div className="-mx-4 -my-4">{open.map(card)}</div>
        )}
      </Section>

      <Section title={`Answered (${answered.length})`}>
        {answered.length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-mid)]">Nothing answered yet.</p>
        ) : (
          <div className="-mx-4 -my-4">{answered.map(card)}</div>
        )}
      </Section>
    </div>
  );
}
