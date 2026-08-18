import { getCommissioner } from "@/lib/admin";
import { contentDefaults } from "@/lib/content/defaults";
import { AdminForm } from "@/components/admin/AdminForm";
import { resetContent, saveContent } from "../actions";
import { Section, inputCls } from "@/components/admin/ui";

// The content editor (ANTE-ADMIN §4.4): every string on the site, grouped by page,
// searchable, with restore-to-default. The one deliberate exception is the
// rulebook — it ships with the code and has no row here (§13).

export const dynamic = "force-dynamic";

export default async function Content({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = (await getCommissioner())!;
  const { q } = await searchParams;
  const query = (q ?? "").toLowerCase();

  const { data: overrides } = await ctx.db.from("content_blocks").select("key, value");
  const overrideMap = new Map((overrides ?? []).map((r) => [r.key, r.value]));

  const keys = Object.keys(contentDefaults)
    .filter((k) => !query || k.toLowerCase().includes(query) || (overrideMap.get(k) ?? contentDefaults[k]).toLowerCase().includes(query))
    .sort();

  const groups = new Map<string, string[]>();
  for (const k of keys) {
    const group = k.split(".")[0];
    groups.set(group, [...(groups.get(group) ?? []), k]);
  }

  return (
    <div>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">Content</h1>
      <form className="mb-4">
        <input name="q" defaultValue={q ?? ""} placeholder="Where does that sentence live? Search keys and text…" className={`${inputCls} w-96`} aria-label="Search content" />
      </form>
      <p className="mb-4 text-xs text-[color:var(--color-text-low)]">
        The rulebook is deliberately absent: it renders from the versioned repo file and changing it requires a deploy (§13).
      </p>

      {[...groups.entries()].map(([group, groupKeys]) => (
        <Section key={group} title={group}>
          <div className="flex flex-col gap-4">
            {groupKeys.map((key) => {
              const current = overrideMap.get(key) ?? contentDefaults[key];
              const overridden = overrideMap.has(key);
              return (
                <div key={key} className="border-b border-[color:var(--color-border)] pb-3 last:border-b-0">
                  <p className="mb-1 text-xs text-[color:var(--color-text-low)]">
                    {key}
                    {overridden && <span className="ml-2 text-[color:var(--color-gold)]">edited</span>}
                  </p>
                  <AdminForm action={saveContent} submitLabel="Save" inline>
                    <input type="hidden" name="key" value={key} />
                    <textarea name="value" defaultValue={current ?? ""} rows={current && current.length > 80 ? 3 : 1} className={`${inputCls} w-full max-w-2xl`} aria-label={key} />
                  </AdminForm>
                  {overridden && (
                    <div className="mt-1">
                      <AdminForm action={resetContent} submitLabel="Restore default" inline>
                        <input type="hidden" name="key" value={key} />
                      </AdminForm>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      ))}
    </div>
  );
}
