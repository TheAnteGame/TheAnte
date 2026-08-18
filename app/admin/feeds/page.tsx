import { DateTime } from "luxon";
import { getCommissioner } from "@/lib/admin";
import { ET } from "@/lib/time";
import { AdminForm } from "@/components/admin/AdminForm";
import { composeTickerItem, hideFeedItem, hideTickerItem, saveFeedSource, toggleFeedSource } from "../actions";
import { Section, inputCls, thCls, tdCls } from "@/components/admin/ui";

// Feeds & ticker (ANTE-ADMIN §4.5). Manual items are yours to write; feed items can
// be hidden but never edited — editing a headline you didn't write is how a ticker
// becomes a liability. System items live in the app and are toggled in settings.

export const dynamic = "force-dynamic";

export default async function Feeds() {
  const ctx = (await getCommissioner())!;
  const db = ctx.db;

  const now = new Date().toISOString();
  const [{ data: items }, { data: sources }, { data: recentFeed }] = await Promise.all([
    db.from("ticker_items").select("*").eq("hidden", false).order("pinned", { ascending: false }).order("priority", { ascending: false }).order("created_at", { ascending: false }).limit(30),
    db.from("feed_sources").select("*").order("kind").order("name"),
    db.from("feed_items").select("*").eq("hidden", false).order("fetched_at", { ascending: false }).limit(25),
  ]);

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">Feeds & ticker</h1>

      <Section title="Compose a ticker item">
        <AdminForm action={composeTickerItem} submitLabel="Publish" inline>
          <input name="text" maxLength={140} required placeholder="140 characters, rendered as-is" className={`${inputCls} w-96`} aria-label="Text" />
          <input name="url" placeholder="click-through URL (optional)" className={`${inputCls} w-56`} aria-label="URL" />
          <label className="flex items-center gap-1 text-xs text-[color:var(--color-text-mid)]">
            <input type="checkbox" name="pinned" /> pin
          </label>
          <input name="priority" type="number" defaultValue={0} className={`${inputCls} nums w-16`} aria-label="Priority" />
          <input name="startsAt" type="datetime-local" className={inputCls} aria-label="Starts at" />
          <input name="endsAt" type="datetime-local" className={inputCls} aria-label="Ends at" />
        </AdminForm>
      </Section>

      <Section title="Rail — as players will see it">
        {(items ?? []).length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-mid)]">No stored items. System items (deadline, Pot, leader…) still render on their own.</p>
        ) : (
          <ul className="space-y-2">
            {(items ?? []).map((t) => {
              const live =
                (!t.starts_at || t.starts_at <= now) && (!t.ends_at || t.ends_at > now);
              return (
                <li key={t.id} className="flex items-center gap-3 text-sm">
                  <span className={`w-14 text-[10px] uppercase tracking-wider ${t.source === "manual" ? "text-[color:var(--color-chrome)]" : "text-[color:var(--color-text-low)]"}`}>
                    {t.source}
                  </span>
                  <span className={live ? "text-[color:var(--color-text-hi)]" : "text-[color:var(--color-text-low)] line-through"}>
                    {t.pinned && <span className="mr-1 text-[color:var(--color-gold)]">📌</span>}
                    {t.text}
                  </span>
                  <AdminForm action={hideTickerItem} submitLabel="Hide" danger inline>
                    <input type="hidden" name="itemId" value={t.id} />
                  </AdminForm>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Sources">
        <AdminForm action={saveFeedSource} submitLabel="Add source" inline>
          <select name="kind" className={inputCls} aria-label="Kind">
            <option value="league_ticker">League ticker</option>
            <option value="team_news">Team news</option>
          </select>
          <input name="name" required placeholder="name" className={`${inputCls} w-40`} aria-label="Name" />
          <input name="url" required placeholder="RSS/Atom URL" className={`${inputCls} w-72`} aria-label="URL" />
          <input name="teamCode" placeholder="team code (team news only)" className={`${inputCls} w-40`} aria-label="Team code" />
          <input name="priority" type="number" defaultValue={0} className={`${inputCls} nums w-16`} aria-label="Priority" />
        </AdminForm>

        <table className="mt-4 w-full">
          <thead>
            <tr className="border-b border-[color:var(--color-border)]">
              <th className={thCls}>Source</th>
              <th className={thCls}>Kind</th>
              <th className={thCls}>Last fetch</th>
              <th className={thCls}>Status</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody>
            {(sources ?? []).map((s) => (
              <tr key={s.id} className="border-b border-[color:var(--color-border)] last:border-b-0">
                <td className={tdCls}>
                  {s.name}
                  <span className="ml-2 text-xs text-[color:var(--color-text-low)]">{s.team_code ?? ""}</span>
                </td>
                <td className={tdCls}>{s.kind}</td>
                <td className={`${tdCls} text-xs text-[color:var(--color-text-low)]`}>
                  {s.last_fetched_at ? DateTime.fromISO(s.last_fetched_at).setZone(ET).toRelative() : "never"}
                </td>
                <td className={`${tdCls} ${s.last_status === "error" ? "text-[color:var(--color-loss)]" : ""}`}>
                  {s.enabled ? (s.last_status ?? "—") : "disabled"}
                  {s.last_error && <span className="ml-1 text-xs">({s.last_error})</span>}
                </td>
                <td className={tdCls}>
                  <AdminForm action={toggleFeedSource} submitLabel={s.enabled ? "Disable" : "Enable"} inline>
                    <input type="hidden" name="sourceId" value={s.id} />
                  </AdminForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-[color:var(--color-text-low)]">
          Ingest runs every 15 minutes (feeds.sync). Feed headlines can be hidden below, never edited.
        </p>
      </Section>

      <Section title="Recent ingested items">
        {(recentFeed ?? []).length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-mid)]">Nothing ingested yet.</p>
        ) : (
          <ul className="space-y-1">
            {(recentFeed ?? []).map((f) => (
              <li key={f.id} className="flex items-center gap-3 text-sm">
                <span className="w-10 text-[10px] uppercase text-[color:var(--color-text-low)]">{f.team_code ?? "all"}</span>
                <span className="text-[color:var(--color-text-mid)]">{f.title}</span>
                <AdminForm action={hideFeedItem} submitLabel="Hide" danger inline>
                  <input type="hidden" name="itemId" value={f.id} />
                </AdminForm>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
