import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { NewsFader } from "./NewsFader";

// Fav Team News (ANTE-PLAYER §7): the player's team's headlines, cross-fading every
// 5s, falling back to league-wide items when a team has none. Fully automatic from
// the feed; the commissioner curates only by hiding (ADMIN §0).

export async function NewsBox({ playerId }: { playerId: string }) {
  const db = createUserClient();

  const [{ data: me }, heading, empty, sourceLabel] = await Promise.all([
    db.from("players").select("favorite_team").eq("id", playerId).maybeSingle(),
    getContent("dash.news.heading"),
    getContent("dash.news.empty"),
    getContent("dash.news.source_label"),
  ]);

  // The source travels with the item so a player can see who wrote it and go read it.
  type Row = { id: string; title: string; url: string | null; feed_sources: { name: string } | { name: string }[] | null };
  const named = (rows: Row[] | null) =>
    (rows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      source: (Array.isArray(r.feed_sources) ? r.feed_sources[0]?.name : r.feed_sources?.name) ?? null,
    }));

  let items: Array<{ id: string; title: string; url: string | null; source: string | null }> = [];
  if (me?.favorite_team) {
    const { data } = await db
      .from("feed_items")
      .select("id, title, url, feed_sources(name)")
      .eq("team_code", me.favorite_team)
      .order("published_at", { ascending: false })
      .limit(8);
    items = named(data as Row[] | null);
  }
  if (items.length === 0) {
    const { data } = await db
      .from("feed_items")
      .select("id, title, url, feed_sources(name)")
      .is("team_code", null)
      .order("published_at", { ascending: false })
      .limit(8);
    items = named(data as Row[] | null);
  }

  const { data: rotate } = await db.from("app_settings").select("value").eq("key", "news.rotate_ms").maybeSingle();
  const rotateMs = typeof rotate?.value === "number" ? rotate.value : 5000;

  return (
    <section aria-label={heading} className="panel">
      <h2 className="panel-head px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-chrome)]">
        {heading}
      </h2>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-sm text-[color:var(--color-text-mid)]">{empty}</p>
      ) : (
        <NewsFader items={items} rotateMs={rotateMs} sourceLabel={sourceLabel} />
      )}
    </section>
  );
}
