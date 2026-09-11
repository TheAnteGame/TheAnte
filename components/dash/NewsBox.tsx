import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { NewsFader } from "./NewsFader";

// Your team's headlines (ANTE-PLAYER §7). Every feed that carries the team feeds this
// box — the source shown is simply whoever wrote the story on screen. Team news first,
// league-wide when the team has none. The commissioner curates only by hiding (§0).

export async function NewsBox({ playerId }: { playerId: string }) {
  const db = createUserClient();

  const [{ data: me }, heading, empty, sourceLabel] = await Promise.all([
    db.from("players").select("favorite_team").eq("id", playerId).maybeSingle(),
    getContent("dash.news.heading"),
    getContent("dash.news.empty"),
    getContent("dash.news.source_label"),
  ]);

  // The source travels with the item so a player can see who wrote it.
  type Row = { id: string; title: string; url: string | null; feed_sources: { name: string } | { name: string }[] | null };
  const named = (rows: Row[] | null) =>
    (rows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      source: (Array.isArray(r.feed_sources) ? r.feed_sources[0]?.name : r.feed_sources?.name) ?? null,
    }));

  const fetchRows = async (teamCode: string | null) => {
    const q = db
      .from("feed_items")
      .select("id, title, url, feed_sources(name)")
      .order("published_at", { ascending: false })
      .limit(8);
    const { data } = await (teamCode === null ? q.is("team_code", null) : q.eq("team_code", teamCode));
    return named(data as Row[] | null);
  };

  let items = me?.favorite_team ? await fetchRows(me.favorite_team) : [];
  if (items.length === 0) items = await fetchRows(null);

  return (
    <section aria-label={heading} className="panel">
      <h2 className="panel-head px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-heading)]">
        {heading}
      </h2>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-sm text-[color:var(--color-text-mid)]">{empty}</p>
      ) : (
        <NewsFader items={items} sourceLabel={sourceLabel} />
      )}
    </section>
  );
}
