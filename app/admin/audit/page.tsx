import { DateTime } from "luxon";
import { getCommissioner } from "@/lib/admin";
import { ET } from "@/lib/time";
import { Section, inputCls, thCls, tdCls } from "@/components/admin/ui";

// The audit log (ANTE-ADMIN §4.9): append-only at the database level — a
// commissioner who can edit the audit log has no audit log. No delete, no edit.

export const dynamic = "force-dynamic";

export default async function Audit({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = (await getCommissioner())!;
  const { q } = await searchParams;

  let query = ctx.db.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
  if (q) query = query.ilike("action", `%${q}%`);
  const { data: entries } = await query;

  const actorIds = [...new Set((entries ?? []).map((e) => e.actor_player_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await ctx.db.from("players").select("id, first_name, last_name").in("id", actorIds)
    : { data: [] };
  const nameOf = (id: string | null) => {
    const a = (actors ?? []).find((x) => x.id === id);
    return a ? `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() : "system";
  };

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">Audit</h1>
      <form className="mb-4">
        <input name="q" defaultValue={q ?? ""} placeholder="filter by action…" className={`${inputCls} w-72`} aria-label="Filter" />
      </form>

      <Section title={`${(entries ?? []).length} entries — append-only, forever`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-[color:var(--color-border)]">
                <th className={thCls}>When (ET)</th>
                <th className={thCls}>Actor</th>
                <th className={thCls}>Action</th>
                <th className={thCls}>Entity</th>
                <th className={thCls}>Reason</th>
                <th className={thCls}>Public</th>
              </tr>
            </thead>
            <tbody>
              {(entries ?? []).map((e) => (
                <tr key={e.id} className="border-b border-[color:var(--color-border)] align-top last:border-b-0">
                  <td className={`${tdCls} nums whitespace-nowrap text-xs text-[color:var(--color-text-low)]`}>
                    {DateTime.fromISO(e.created_at).setZone(ET).toFormat("LL/dd h:mma")}
                  </td>
                  <td className={tdCls}>{nameOf(e.actor_player_id)}</td>
                  <td className={`${tdCls} text-[color:var(--color-text-hi)]`}>{e.action}</td>
                  <td className={`${tdCls} text-xs text-[color:var(--color-text-low)]`}>
                    {e.entity_type} {e.entity_id}
                  </td>
                  <td className={`${tdCls} max-w-md`}>{e.reason}</td>
                  <td className={tdCls}>{e.public ? <span className="text-[color:var(--color-gold)]">●</span> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
