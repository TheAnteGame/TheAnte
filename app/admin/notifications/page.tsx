import { getCommissioner } from "@/lib/admin";
import { contentDefaults } from "@/lib/content/defaults";
import { AdminForm } from "@/components/admin/AdminForm";
import { saveContent } from "../actions";
import { Section, inputCls } from "@/components/admin/ui";

// Notification templates (ANTE-ADMIN §4.7). Email carries everything season one;
// SMS controls are visible but disabled pending A2P 10DLC (DECISIONS D-001).
// Sends wire up in Phase 11; templates are editable now. One rule overrides every
// template: no body may contain pre-reveal pick data — the send path validates.

export const dynamic = "force-dynamic";

const EVENTS: Array<[string, string, string]> = [
  ["notify.slate_open", "Slate open", "Tue 6:05am ET"],
  ["notify.reminder", "Reminder (unsubmitted only)", "Wed 6:00pm ET"],
  ["notify.final_call", "Final call (unsubmitted only)", "Thu 9:00am ET"],
  ["notify.nudge", "Manual nudge", "On demand from Ops"],
  ["notify.reveal", "Reveal fired", "Immediate"],
  ["notify.settled", "Settled", "After the final game"],
  ["notify.pot", "Pot awarded", "With settlement"],
  ["notify.correction", "Commissioner correction", "On re-settlement"],
];

export default async function Notifications() {
  const ctx = (await getCommissioner())!;
  const { data: overrides } = await ctx.db.from("content_blocks").select("key, value").like("key", "notify.%");
  const overrideMap = new Map((overrides ?? []).map((r) => [r.key, r.value]));

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">Notifications</h1>
      <p className="mb-4 max-w-2xl text-sm text-[color:var(--color-text-mid)]">
        All notifications send as <span className="text-[color:var(--color-text-hi)]">email</span> this season.
        <span className="ml-2 border border-[color:var(--color-border)] px-2 py-0.5 text-xs text-[color:var(--color-text-low)]">
          SMS pending carrier approval (D-001)
        </span>
      </p>

      <Section title="Templates">
        <div className="flex flex-col gap-4">
          {EVENTS.map(([key, label, timing]) => (
            <div key={key} className="border-b border-[color:var(--color-border)] pb-3 last:border-b-0">
              <p className="mb-1 text-xs text-[color:var(--color-text-low)]">
                <span className="text-[color:var(--color-text-hi)]">{label}</span> · {timing} · variables like{" "}
                {"{week} {ante} {delta} {stack} {rank}"} fill at send
              </p>
              <AdminForm action={saveContent} submitLabel="Save" inline>
                <input type="hidden" name="key" value={key} />
                <textarea name="value" rows={2} defaultValue={overrideMap.get(key) ?? contentDefaults[key] ?? ""} className={`${inputCls} w-full max-w-2xl`} aria-label={label} />
              </AdminForm>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
