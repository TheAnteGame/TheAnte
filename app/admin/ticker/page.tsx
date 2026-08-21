import { DateTime } from "luxon";
import { getCommissioner } from "@/lib/admin";
import { ET } from "@/lib/time";
import { contentDefaults } from "@/lib/content/defaults";
import { AdminForm } from "@/components/admin/AdminForm";
import { TickerSpeed } from "@/components/admin/TickerSpeed";
import { Section, inputCls, thCls, tdCls } from "@/components/admin/ui";
import { composeTickerItem, hideTickerItem, saveTickerSettings } from "../actions";
import { DEFAULT_ACCENT, DEFAULT_SPEED, DEFAULT_TEXT, TICKER_COLORS } from "@/lib/ticker/style";

// The rail, in one place (ADMIN §4.5): how it looks and moves, which league facts
// it generates, and every line currently on it. Removing a line hides it — nothing
// in this product is ever deleted (rulebook §14), so a pulled line stays auditable.

export const dynamic = "force-dynamic";

// The six generated lines, each shown with the wording it will actually use, so the
// commissioner is switching a sentence on and off rather than a bare key.
const SYSTEM_LINES: Array<{ key: string; label: string; contentKey: string; when: string }> = [
  { key: "deadline", label: "Deadline countdown", contentKey: "ticker.deadline", when: "While the week is open" },
  { key: "waiting_on", label: "Waiting on", contentKey: "ticker.waiting_on", when: "Open week, before the reveal" },
  { key: "pot", label: "Pot size", contentKey: "ticker.pot", when: "Always, once a week exists" },
  { key: "marker", label: "Marker carried", contentKey: "ticker.marker", when: "Only when the Pot carries a marker" },
  { key: "reveal", label: "Reveal fired", contentKey: "ticker.reveal", when: "For 6 hours after the reveal" },
  { key: "leader", label: "Current leader", contentKey: "ticker.leader", when: "Always, once standings exist" },
];

export default async function TickerAdmin() {
  const ctx = (await getCommissioner())!;
  const db = ctx.db;

  const [{ data: settingsRows }, { data: items }] = await Promise.all([
    db
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "ticker.enabled",
        "ticker.max_items",
        "ticker.system_items",
        "ticker.speed_seconds",
        "ticker.accent_color",
        "ticker.text_color",
        "ticker.auto_feed",
      ]),
    db
      .from("ticker_items")
      .select("id, source, text, url, pinned, priority, hidden, created_at")
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const settings = new Map((settingsRows ?? []).map((r) => [r.key, r.value]));
  const enabled = settings.get("ticker.enabled") !== false;
  // Off unless explicitly turned on — a wire feed is not curated (D-025).
  const autoFeed = settings.get("ticker.auto_feed") === true;
  const speed = typeof settings.get("ticker.speed_seconds") === "number" ? (settings.get("ticker.speed_seconds") as number) : DEFAULT_SPEED;
  const accent = (settings.get("ticker.accent_color") as string) ?? DEFAULT_ACCENT;
  const text = (settings.get("ticker.text_color") as string) ?? DEFAULT_TEXT;
  const maxItems = typeof settings.get("ticker.max_items") === "number" ? (settings.get("ticker.max_items") as number) : 12;
  const sys = (settings.get("ticker.system_items") ?? {}) as Record<string, boolean>;

  const colorSelect = (name: string, current: string, label: string) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-low)]">{label}</span>
      <select name={name} defaultValue={current} className={`${inputCls} w-56`}>
        {TICKER_COLORS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <span className="flex items-center gap-2 text-[12px] text-[color:var(--color-text-low)]">
        {TICKER_COLORS.map((c) => (
          <span
            key={c.value}
            title={c.label}
            className={`inline-block h-3 w-3 ${c.value === current ? "outline outline-1 outline-offset-1 outline-[color:var(--color-chrome)]" : ""}`}
            style={{ background: c.css }}
          />
        ))}
      </span>
    </label>
  );

  return (
    <div>
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">Ticker</h1>
      <p className="mb-4 max-w-3xl text-xs text-[color:var(--color-text-low)]">
        The scrolling rail across the top of every player&apos;s dashboard. It blends three things: lines you post here,
        league facts the app generates, and headlines pulled from the feeds. Removing a line hides it — nothing is
        deleted, so it stays in the record.
      </p>

      <Section title="How it looks and moves">
        <AdminForm action={saveTickerSettings} submitLabel="Save ticker settings">
          <label className="flex items-center gap-2 text-sm text-[color:var(--color-text-hi)]">
            <input type="checkbox" name="enabled" defaultChecked={enabled} className="accent-[color:var(--color-gold)]" />
            Show the ticker on the dashboard
          </label>

          <label className="flex items-start gap-2 text-sm text-[color:var(--color-text-hi)]">
            <input
              type="checkbox"
              name="autoFeed"
              defaultChecked={autoFeed}
              className="mt-1 accent-[color:var(--color-gold)]"
            />
            <span>
              Put league headlines on the rail automatically
              <span className="mt-0.5 block text-xs text-[color:var(--color-text-low)]">
                Off by default. The wires are not curated — sportsbook promos and betting odds come
                through them, and this product does not carry a cash surface. Leave this off and post
                what you want yourself.
              </span>
            </span>
          </label>

          <TickerSpeed initial={speed} />

          <div className="flex flex-wrap gap-6">
            {colorSelect("accentColor", accent, "League facts")}
            {colorSelect("textColor", text, "Posts and headlines")}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-low)]">
              Most lines on the rail at once
            </span>
            <input type="number" name="maxItems" min={1} max={40} defaultValue={maxItems} className={`${inputCls} w-24`} />
          </label>

          <fieldset className="mt-2 border border-[color:var(--color-border)] p-3">
            <legend className="px-1 text-xs uppercase tracking-wider text-[color:var(--color-text-low)]">
              League facts the app writes for you
            </legend>
            <div className="flex flex-col gap-2">
              {SYSTEM_LINES.map((line) => (
                <label key={line.key} className="flex flex-wrap items-baseline gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={`sys.${line.key}`}
                    defaultChecked={sys[line.key] !== false}
                    className="accent-[color:var(--color-gold)]"
                  />
                  <span className="w-40 shrink-0 text-[color:var(--color-text-hi)]">{line.label}</span>
                  <span className="text-xs text-[color:var(--color-text-mid)]">
                    &ldquo;{contentDefaults[line.contentKey]}&rdquo;
                  </span>
                  <span className="text-[12px] uppercase tracking-wider text-[color:var(--color-text-low)]">{line.when}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-[color:var(--color-text-low)]">
              The wording of these lines lives in Content under <code>ticker.*</code>.
            </p>
          </fieldset>
        </AdminForm>
      </Section>

      <Section title="Post a line">
        <AdminForm action={composeTickerItem} submitLabel="Publish">
          <input name="text" required maxLength={140} placeholder="Up to 140 characters" className={`${inputCls} w-full max-w-2xl`} aria-label="Ticker text" />
          <input name="url" placeholder="Link (optional)" className={`${inputCls} w-full max-w-2xl`} aria-label="Link" />
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="pinned" className="accent-[color:var(--color-gold)]" />
              Pin to the front
            </label>
            <label className="flex items-center gap-2 text-sm">
              Priority
              <input type="number" name="priority" defaultValue={0} min={0} max={9} className={`${inputCls} w-20`} />
            </label>
          </div>
        </AdminForm>
      </Section>

      <Section title={`On the rail now (${(items ?? []).length})`}>
        {(items ?? []).length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-mid)]">
            Nothing posted or pulled yet. League facts above still run on their own.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={thCls}>Line</th>
                <th className={thCls}>From</th>
                <th className={thCls}>Posted</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((t) => (
                <tr key={t.id} className="border-t border-[color:var(--color-border)] align-top">
                  <td className={`${tdCls} text-[color:var(--color-text-hi)]`}>
                    {t.pinned && <span className="mr-2 text-[color:var(--color-gold)]">pinned</span>}
                    {t.text}
                  </td>
                  <td className={`${tdCls} text-[color:var(--color-text-mid)]`}>{t.source}</td>
                  <td className={`${tdCls} nums text-[color:var(--color-text-low)]`}>
                    {DateTime.fromISO(t.created_at).setZone(ET).toFormat("LLL d, h:mma")}
                  </td>
                  <td className={tdCls}>
                    <AdminForm
                      action={hideTickerItem}
                      submitLabel="Remove"
                      danger
                      inline
                      confirmText="Take this line off the rail? It stays in the record, it just stops showing."
                    >
                      <input type="hidden" name="itemId" value={t.id} />
                    </AdminForm>
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
