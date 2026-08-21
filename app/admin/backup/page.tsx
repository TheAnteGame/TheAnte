import { DateTime } from "luxon";
import { getCommissioner } from "@/lib/admin";
import { ET } from "@/lib/time";
import { AdminForm } from "@/components/admin/AdminForm";
import { Section, Stat, inputCls, thCls, tdCls } from "@/components/admin/ui";
import { confirmBackupDownload, takeSnapshotNow } from "../actions";
import { SNAPSHOT_TABLES } from "@/lib/backup/snapshot";

// Backups (D-015). Two different jobs, kept visibly separate on this page because
// conflating them is how people end up with no backup at all:
//
//   * Snapshots live in this database. They protect against a BAD WRITE — a
//     settlement that came out wrong — and one is taken automatically before every
//     operation that can rewrite chips.
//   * The download is a file on your own disk. It is the ONLY thing that protects
//     against losing the project itself.

export const dynamic = "force-dynamic";

export default async function Backup() {
  const ctx = (await getCommissioner())!;

  const { data: settingRows } = await ctx.db
    .from("app_settings")
    .select("key, value")
    .in("key", ["backup.last_confirmed_at", "backup.remind_after_days"]);
  const settings = new Map((settingRows ?? []).map((r) => [r.key, r.value]));
  const lastConfirmedRaw = settings.get("backup.last_confirmed_at");
  const lastConfirmed = typeof lastConfirmedRaw === "string" ? DateTime.fromISO(lastConfirmedRaw) : null;
  const everyDays = typeof settings.get("backup.remind_after_days") === "number" ? (settings.get("backup.remind_after_days") as number) : 7;
  const daysSince = lastConfirmed ? Math.floor(DateTime.now().diff(lastConfirmed, "days").days) : null;
  const overdue = daysSince === null || daysSince >= everyDays;

  const { data: snapshots } = await ctx.db
    .from("league_snapshots")
    .select("id, created_at, reason, size_bytes, chip_total")
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = snapshots ?? [];

  return (
    <div>
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">Backups</h1>
      <p className="mb-4 max-w-3xl text-xs text-[color:var(--color-text-low)]">
        The league record: roster, season, every ticket and bet, the ledger, chat, and the audit trail. News headlines
        and job telemetry are left out — they refill themselves.
      </p>

      <Section title={overdue ? "Download a copy — due now" : "Download a copy"}>
        <div className="flex flex-wrap items-end gap-8">
          <Stat
            label="Last saved to your disk"
            value={lastConfirmed ? (lastConfirmed.setZone(ET).toRelative() ?? "—") : "never"}
            accent={overdue ? "loss" : undefined}
          />
          <Stat label="Snapshots held" value={rows.length} />
          <Stat label="Tables covered" value={SNAPSHOT_TABLES.length} />
          <a
            href="/admin/backup/download"
            className="chamfer chrome-face px-5 py-2 text-sm font-semibold uppercase tracking-wide"
          >
            Download current data
          </a>
          <AdminForm action={confirmBackupDownload} submitLabel="I've got the file" inline />
        </div>
        <p className="mt-3 max-w-3xl text-xs text-[color:var(--color-text-hi)]">
          <strong className="text-[color:var(--color-gold)]">Twice a week:</strong> once on Thursday after the reveal
          fires (the week&apos;s tickets are locked and cannot be reconstructed), and once on Tuesday morning after
          settlement, before the new slate opens. Those are the two moments that create data nothing else can rebuild.
        </p>
        <p className="mt-2 max-w-3xl text-xs text-[color:var(--color-text-mid)]">
          This is the copy that matters. Snapshots below live in the same database they are protecting, so they survive a
          bad settlement but not a lost project. Download the file, keep it somewhere else, then press
          &ldquo;I&apos;ve got the file&rdquo; — that is the only way the reminder knows, and it emails you every day
          until you do.
        </p>
      </Section>

      <Section title="Take a snapshot now">
        <AdminForm action={takeSnapshotNow} submitLabel="Take snapshot">
          <input
            name="reason"
            placeholder="What are you about to do? (e.g. before hand-editing week 3)"
            className={`${inputCls} w-full max-w-xl`}
            aria-label="Snapshot reason"
          />
        </AdminForm>
        <p className="mt-3 text-xs text-[color:var(--color-text-low)]">
          One is taken automatically before settlement, re-settlement, a forced reveal, and season close. Only the 20
          most recent are kept.
        </p>
      </Section>

      <Section title="Snapshots">
        {rows.length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-mid)]">None yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={thCls}>Taken</th>
                <th className={thCls}>Reason</th>
                <th className={thCls}>Chips in ledger</th>
                <th className={thCls}>Size</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[color:var(--color-border)]">
                  <td className={`${tdCls} nums text-[color:var(--color-text-hi)]`}>
                    {DateTime.fromISO(r.created_at).setZone(ET).toFormat("LLL d, h:mma 'ET'")}
                  </td>
                  <td className={`${tdCls} text-[color:var(--color-text-mid)]`}>{r.reason}</td>
                  <td className={`${tdCls} nums text-[color:var(--color-text-mid)]`}>{r.chip_total ?? "—"}</td>
                  <td className={`${tdCls} nums text-[color:var(--color-text-low)]`}>
                    {(r.size_bytes / 1024).toFixed(0)} KB
                  </td>
                  <td className={tdCls}>
                    <a
                      href={`/admin/backup/download?id=${r.id}`}
                      className="text-sm text-[color:var(--color-gold)] underline-offset-4 hover:underline"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
