import { getCommissioner } from "@/lib/admin";
import { contentDefaults } from "@/lib/content/defaults";
import { groupInfo } from "@/lib/content/groups";
import { AdminForm } from "@/components/admin/AdminForm";
import { resetContent, saveContent } from "../actions";
import { inputCls } from "@/components/admin/ui";

// The content editor (ANTE-ADMIN §4.4): every string on the site, grouped by page,
// searchable, with restore-to-default. The one deliberate exception is the
// rulebook — it ships with the code and has no row here (§13).
//
// The page is long by nature, so it carries its own jump menu, and every group says
// in plain English which screen it belongs to. Editing is desktop work: the fields
// are full-width and multi-line rather than one-line slots you have to scroll.

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

  const ordered = [...groups.entries()].sort((a, b) => groupInfo(a[0]).title.localeCompare(groupInfo(b[0]).title));
  const editedCount = ordered.reduce((n, [, ks]) => n + ks.filter((k) => overrideMap.has(k)).length, 0);

  return (
    <div>
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-xl font-bold uppercase text-[color:var(--color-chrome)]">Content</h1>
      <p className="mb-4 text-xs text-[color:var(--color-text-low)]">
        Every word on the player&apos;s side of the site. {editedCount > 0 && <>{editedCount} edited from the default. </>}
        The rulebook is deliberately absent: it renders from the versioned repo file and changing it requires a deploy (§13).
      </p>

      <form className="mb-5">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Where does that sentence live? Search keys and text…"
          className={`${inputCls} w-full max-w-2xl`}
          aria-label="Search content"
        />
      </form>

      {/* Jump menu — the page is long, so it says up front what is on it. */}
      <nav aria-label="Jump to a section" className="mb-8 border border-[color:var(--color-border)] p-4">
        <p className="mb-3 text-[12px] uppercase tracking-widest text-[color:var(--color-gold)]">Jump to</p>
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map(([group, groupKeys]) => (
            <li key={group}>
              <a href={`#group-${group}`} className="text-sm text-[color:var(--color-text-hi)] underline-offset-4 hover:underline">
                {groupInfo(group).title}
              </a>{" "}
              <span className="text-xs text-[color:var(--color-text-low)]">({groupKeys.length})</span>
            </li>
          ))}
        </ul>
      </nav>

      {ordered.map(([group, groupKeys]) => {
        const info = groupInfo(group);
        return (
          <section key={group} id={`group-${group}`} className="mb-8 scroll-mt-6 border border-[color:var(--color-border)]">
            <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase text-[color:var(--color-chrome)]">
                  {info.title}
                </h2>
                <code className="text-[12px] text-[color:var(--color-text-low)]">{group}.*</code>
                <a href="#top" className="ml-auto text-[12px] text-[color:var(--color-text-low)] underline-offset-4 hover:underline">
                  Back to top
                </a>
              </div>
              {info.where && <p className="mt-1 max-w-3xl text-xs text-[color:var(--color-text-mid)]">{info.where}</p>}
            </header>

            <div className="flex flex-col">
              {groupKeys.map((key) => {
                const current = overrideMap.get(key) ?? contentDefaults[key];
                const overridden = overrideMap.has(key);
                const long = (current ?? "").length;
                return (
                  <div key={key} className="border-b border-[color:var(--color-border)] px-4 py-4 last:border-b-0">
                    <p className="mb-1.5 flex flex-wrap items-baseline gap-2">
                      <code className="text-xs text-[color:var(--color-text-low)]">{key}</code>
                      {overridden && <span className="text-[12px] uppercase tracking-wider text-[color:var(--color-gold)]">edited</span>}
                    </p>
                    <AdminForm action={saveContent} submitLabel="Save">
                      <input type="hidden" name="key" value={key} />
                      <textarea
                        name="value"
                        defaultValue={current ?? ""}
                        rows={long > 400 ? 8 : long > 160 ? 5 : 3}
                        className={`${inputCls} w-full resize-y font-normal leading-relaxed`}
                        aria-label={key}
                      />
                    </AdminForm>
                    {overridden && (
                      <div className="mt-2">
                        <AdminForm action={resetContent} submitLabel="Restore default" inline>
                          <input type="hidden" name="key" value={key} />
                        </AdminForm>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
