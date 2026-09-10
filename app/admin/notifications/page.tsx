import { DateTime } from "luxon";
import { getCommissioner } from "@/lib/admin";
import { contentDefaults } from "@/lib/content/defaults";
import { AdminForm } from "@/components/admin/AdminForm";
import { saveContent } from "../actions";
import { Section, inputCls } from "@/components/admin/ui";
import { ET } from "@/lib/time";
import { MAIL_KINDS, SCHEDULED_JOBS } from "@/lib/notify/catalogue";

// Notifications (ANTE-ADMIN §4.7), rebuilt as a mail LOG rather than a template list
// (D-067). The console previously showed eight editable strings and nothing else, so
// there was no way to answer the only questions that matter in a live season: did it
// go out, to whom, and what did it actually say. Three sections now:
//
//   Scheduled — every cron that can send, when it fires, and when it last ran.
//   Sent      — notification_log, newest first, with the delivered body kept.
//   Templates — the editable strings, each marked live or label-only.
//
// Email carries everything season one; SMS controls stay disabled (D-001).

export const dynamic = "force-dynamic";

const PAGE = 150;

function fmt(iso: string | null): string {
  return iso ? DateTime.fromISO(iso).setZone(ET).toFormat("ccc LLL d, h:mma") : "—";
}

/** Longest matching prefix — template keys carry a week and a player id after it. */
function kindFor(templateKey: string) {
  let best: (typeof MAIL_KINDS)[number] | undefined;
  for (const k of MAIL_KINDS) {
    if (templateKey.startsWith(k.keyPrefix) && (!best || k.keyPrefix.length > best.keyPrefix.length)) best = k;
  }
  return best;
}

export default async function Notifications() {
  const ctx = (await getCommissioner())!;

  // Last run is asked PER JOB, not sliced off one big list. reveal.check runs every
  // two minutes and holds 651 of the rows; a single ordered read — even 400 deep —
  // never reaches back to slate.open, which fires twice a week, and the page then
  // reported a perfectly healthy job as "never seen". Eight indexed reads instead.
  const [{ data: overrides }, { data: log }, { data: players }, ...runRows] = await Promise.all([
    ctx.db.from("content_blocks").select("key, value").like("key", "notify.%"),
    ctx.db
      .from("notification_log")
      .select("id, player_id, channel, template_key, body, status, error, provider_message_id, sent_at")
      .order("sent_at", { ascending: false })
      .limit(PAGE),
    ctx.db.from("players").select("id, first_name, last_name, email"),
    ...SCHEDULED_JOBS.map((j) =>
      ctx.db
        .from("job_runs")
        .select("job_key, started_at, status, detail")
        .eq("job_key", j.jobKey)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  ]);

  const overrideMap = new Map((overrides ?? []).map((r) => [r.key, r.value as string]));
  const nameOf = new Map((players ?? []).map((p) => [p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—"]));
  const emailOf = new Map((players ?? []).map((p) => [p.id, p.email as string | null]));

  const lastRun = new Map<string, { started_at: string; status: string; detail: unknown }>();
  for (const r of runRows) if (r.data) lastRun.set(r.data.job_key, r.data);

  const rows = log ?? [];
  const failures = rows.filter((r) => r.status !== "sent" && r.status !== "queued");

  // A double send is the failure mode this page was built after: two jobs reached the
  // reveal a second apart and nine of fifteen players got the board twice (D-067).
  // Same (player, template_key) more than once is exactly that shape, so it is
  // counted here rather than left for someone to notice in an inbox.
  const seen = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.player_id}|${r.template_key}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const doubled = new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));

  const sentCounts = new Map<string, number>();
  for (const r of rows) {
    const k = kindFor(r.template_key);
    if (k) sentCounts.set(k.keyPrefix, (sentCounts.get(k.keyPrefix) ?? 0) + 1);
  }

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-heading)]">
        Notifications
      </h1>
      <p className="mb-4 max-w-3xl text-sm text-[color:var(--color-text-mid)]">
        Every notification sends as <span className="text-[color:var(--color-text-hi)]">email</span> this season. Nothing
        on this page sends anything by pressing Save — sends come from the scheduled jobs below, or from an action you
        take on the roster.
        <span className="ml-2 border border-[color:var(--color-border)] px-2 py-0.5 text-xs text-[color:var(--color-text-low)]">
          SMS pending carrier approval (D-001)
        </span>
      </p>

      <Section title="Scheduled — what can send, and when">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-[color:var(--color-text-low)]">
                <th className="py-2 pr-3">Job</th>
                <th className="py-2 pr-3">Fires (ET)</th>
                <th className="py-2 pr-3">Emails players</th>
                <th className="py-2 pr-3">Last run</th>
                <th className="py-2">What it does</th>
              </tr>
            </thead>
            <tbody>
              {SCHEDULED_JOBS.map((j) => {
                const r = lastRun.get(j.jobKey);
                return (
                  <tr key={j.jobKey} className="border-t border-[color:var(--color-border)] align-top">
                    <td className="py-2 pr-3 text-[color:var(--color-text-hi)]">
                      {j.jobKey}
                      <div className="text-xs text-[color:var(--color-text-low)]">{j.cronName}</div>
                    </td>
                    <td className="py-2 pr-3 text-[color:var(--color-text-mid)]">
                      {j.whenET}
                      <div className="nums text-xs text-[color:var(--color-text-low)]">{j.expr}</div>
                    </td>
                    <td className="py-2 pr-3">
                      {j.sends ? (
                        <span className="text-[color:var(--color-gold)]">Yes</span>
                      ) : (
                        <span className="text-[color:var(--color-text-low)]">No</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-[color:var(--color-text-mid)]">
                      {fmt(r?.started_at ?? null)}
                      {r ? (
                        <div className={`text-xs ${r.status === "failed" ? "text-[color:var(--color-loss)]" : "text-[color:var(--color-text-low)]"}`}>
                          {r.status}
                        </div>
                      ) : (
                        <div className="text-xs text-[color:var(--color-loss)]">never seen</div>
                      )}
                    </td>
                    <td className="py-2 text-[color:var(--color-text-mid)]">{j.what}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[color:var(--color-text-low)]">
          Schedules are declared by migrations 0006, 0010, 0011 and 0017 and run inside Supabase (pg_cron), not Vercel.
          Last-run times are live from job_runs. Nothing here can be paused from this screen — that takes a migration.
        </p>
      </Section>

      <Section title={`Sent — last ${rows.length} emails`}>
        {failures.length > 0 && (
          <p className="mb-3 border border-[color:var(--color-loss)] px-3 py-2 text-sm text-[color:var(--color-loss)]">
            {failures.length} of the last {rows.length} did not send. Failed rows show the provider error below.
          </p>
        )}
        {doubled.size > 0 && (
          <p className="mb-3 border border-[color:var(--color-gold-dim)] px-3 py-2 text-sm text-[color:var(--color-gold)]">
            {doubled.size} player/email pair{doubled.size === 1 ? "" : "s"} in this window received the same message more
            than once. Rows are marked DOUBLE.
          </p>
        )}
        {rows.length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-mid)]">Nothing has been sent yet.</p>
        ) : (
          <div className="flex flex-col">
            {rows.map((r) => {
              const kind = kindFor(r.template_key);
              const isDouble = doubled.has(`${r.player_id}|${r.template_key}`);
              const bad = r.status !== "sent" && r.status !== "queued";
              return (
                <details key={r.id} className="border-b border-[color:var(--color-border)] py-2">
                  <summary className="cursor-pointer text-sm marker:text-[color:var(--color-text-low)]">
                    <span className="nums mr-3 text-xs text-[color:var(--color-text-low)]">{fmt(r.sent_at)}</span>
                    <span className="mr-2 text-[color:var(--color-text-hi)]">{kind?.label ?? r.template_key}</span>
                    <span className="mr-2 text-[color:var(--color-text-mid)]">
                      {r.player_id ? (nameOf.get(r.player_id) ?? "—") : "—"}
                    </span>
                    {bad ? (
                      <span className="mr-2 border border-[color:var(--color-loss)] px-1 text-[10px] uppercase tracking-wider text-[color:var(--color-loss)]">
                        {r.status}
                      </span>
                    ) : null}
                    {isDouble ? (
                      <span className="mr-2 border border-[color:var(--color-gold-dim)] px-1 text-[10px] uppercase tracking-wider text-[color:var(--color-gold)]">
                        Double
                      </span>
                    ) : null}
                  </summary>
                  <div className="mt-2 pl-1 text-xs text-[color:var(--color-text-low)]">
                    <div>
                      To {r.player_id ? (emailOf.get(r.player_id) ?? "no address on file") : "—"} · {r.channel} ·{" "}
                      {kind ? (overrideMap.get(kind.subjectKey) ?? contentDefaults[kind.subjectKey] ?? "—") : "—"}
                    </div>
                    <div className="nums break-all">
                      key {r.template_key}
                      {r.provider_message_id ? ` · provider ${r.provider_message_id}` : ""}
                    </div>
                    {r.error ? <div className="mt-1 text-[color:var(--color-loss)]">{r.error}</div> : null}
                    {r.body ? (
                      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap border border-[color:var(--color-border)] p-2 text-[color:var(--color-text-mid)]">
                        {r.body}
                      </pre>
                    ) : (
                      <div className="mt-2 italic">No body was stored for this send.</div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </Section>

      <Section title={`Every email this app can send — ${MAIL_KINDS.length}`}>
        <p className="mb-4 max-w-3xl text-sm text-[color:var(--color-text-mid)]">
          This is the complete list: if it is not here, the app cannot send it. Every subject is editable here and
          takes effect on the next send — no deploy, and nothing to change in Resend.{" "}
          <span className="text-[color:var(--color-text-hi)]">Every email sends as HTML with a plain-text twin</span>,
          both rendered from one source so they can never disagree.
        </p>
        <div className="flex flex-col gap-6">
          {MAIL_KINDS.map((k) => {
            const subjectVal = overrideMap.get(k.subjectKey) ?? contentDefaults[k.subjectKey] ?? "";
            const bodyVal = k.bodyKey ? (overrideMap.get(k.bodyKey) ?? contentDefaults[k.bodyKey] ?? "") : null;
            const count = sentCounts.get(k.keyPrefix) ?? 0;
            return (
              <div key={k.keyPrefix} className="border-b border-[color:var(--color-border)] pb-5 last:border-b-0">
                <p className="mb-2 text-xs text-[color:var(--color-text-low)]">
                  <span className="text-sm text-[color:var(--color-text-hi)]">{k.label}</span>
                  <span className="ml-2 border border-[color:var(--color-gold-dim)] px-1 text-[10px] uppercase tracking-wider text-[color:var(--color-gold)]">
                    HTML + text
                  </span>
                  <span className="ml-2">{k.trigger}</span>
                  <span className="ml-2 nums">· {count} sent</span>
                </p>

                <p className="mb-1 text-[11px] uppercase tracking-wider text-[color:var(--color-text-low)]">Subject</p>
                <AdminForm action={saveContent} submitLabel="Save subject" inline>
                  <input type="hidden" name="key" value={k.subjectKey} />
                  <input name="value" defaultValue={subjectVal} className={`${inputCls} w-full max-w-2xl`} aria-label={`${k.label} subject`} />
                </AdminForm>

                <p className="mb-1 mt-3 text-[11px] uppercase tracking-wider text-[color:var(--color-text-low)]">Body</p>
                {bodyVal !== null ? (
                  <AdminForm action={saveContent} submitLabel="Save body" inline>
                    <input type="hidden" name="key" value={k.bodyKey!} />
                    <textarea name="value" rows={4} defaultValue={bodyVal} className={`${inputCls} w-full max-w-2xl`} aria-label={`${k.label} body`} />
                  </AdminForm>
                ) : (
                  <p className="max-w-2xl text-sm text-[color:var(--color-text-mid)]">
                    A designed layout — tables of real games, chip counts and stats, built in code
                    (<span className="nums text-xs">lib/notify/docs.ts</span>). Its wording is not a single string, so it
                    is not editable from here. Ask and it can be changed.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Section>

    </div>
  );
}
