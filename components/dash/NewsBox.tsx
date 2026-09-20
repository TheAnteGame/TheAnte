import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { rotateBySource, type NewsItem } from "@/lib/news/select";
import { NewsFader } from "./NewsFader";
import { NewsSourcePicker } from "./NewsSourcePicker";

// Your team's headlines (ANTE-PLAYER §7). ALWAYS your team and nothing else — the
// point is several outlets reporting on the same team, never league-wide filler
// under a heading that says "Your team" (D-099, owner). Every feed that carries the
// team feeds this box and they take turns rather than the busiest one owning it; a
// player who prefers one outlet pins it from the menu underneath, and pinning
// narrows WHO is reporting, never WHAT they report on. The commissioner curates only
// by hiding (§0).

const SHOW = 8;

export async function NewsBox({ playerId }: { playerId: string }) {
  const db = createUserClient();

  const [{ data: me }, heading, empty, sourceLabel, pickLabel, allLabel] = await Promise.all([
    db.from("players").select("favorite_team, news_source_id").eq("id", playerId).maybeSingle(),
    getContent("dash.news.heading"),
    getContent("dash.news.empty"),
    getContent("dash.news.source_label"),
    getContent("dash.news.pick_label"),
    getContent("dash.news.all_sources"),
  ]);
  const team = me?.favorite_team ?? null;
  const pinned = me?.news_source_id ?? null;

  // What this player may choose between: the enabled feeds that carry THEIR team.
  // The league-wide desks are deliberately not offered — picking one would swap the
  // box's subject, and its subject is the one thing that never changes.
  const { data: sourceRows } = team
    ? await db.from("feed_sources").select("id, name").eq("enabled", true).eq("team_code", team).order("name")
    : { data: [] as Array<{ id: string; name: string }> };
  const offered = sourceRows ?? [];

  // The source travels with the item so a player can see who wrote it.
  type Row = { id: string; title: string; url: string | null; source_id: string | null; feed_sources: { name: string } | { name: string }[] | null };
  const named = (rows: Row[] | null): NewsItem[] =>
    (rows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      sourceId: r.source_id,
      source: (Array.isArray(r.feed_sources) ? r.feed_sources[0]?.name : r.feed_sources?.name) ?? null,
    }));

  // Deeper than SHOW so the rotation has something from each source to draw on.
  const base = () =>
    db.from("feed_items").select("id, title, url, source_id, feed_sources(name)").order("published_at", { ascending: false }).limit(SHOW * 4);

  // The team filter is unconditional, pinned or not: a pinned source narrows the
  // box to one reporter, it does not widen it past the team.
  let items: NewsItem[] = [];
  if (team) {
    const q = base().eq("team_code", team);
    const { data } = await (pinned ? q.eq("source_id", pinned) : q);
    items = rotateBySource(named(data as Row[] | null), SHOW);
  }

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
      {/* Only worth showing when there is actually a choice to make. */}
      {offered.length > 1 && (
        <NewsSourcePicker label={pickLabel} allLabel={allLabel} current={pinned} sources={offered.map((s) => ({ id: s.id, name: s.name }))} />
      )}
    </section>
  );
}
