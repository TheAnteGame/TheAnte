import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { NewsFader } from "./NewsFader";

// Fav Team News (ANTE-PLAYER §7): the player's team's headlines, cross-fading every
// 5s, falling back to league-wide items when a team has none. Fully automatic from
// the feed; the commissioner curates only by hiding (ADMIN §0).

export async function NewsBox({ playerId }: { playerId: string }) {
  const db = createUserClient();

  const [{ data: me }, heading, empty] = await Promise.all([
    db.from("players").select("favorite_team").eq("id", playerId).maybeSingle(),
    getContent("dash.news.heading"),
    getContent("dash.news.empty"),
  ]);

  let items: Array<{ id: string; title: string; url: string | null }> = [];
  if (me?.favorite_team) {
    const { data } = await db
      .from("feed_items")
      .select("id, title, url")
      .eq("team_code", me.favorite_team)
      .order("published_at", { ascending: false })
      .limit(8);
    items = data ?? [];
  }
  if (items.length === 0) {
    const { data } = await db
      .from("feed_items")
      .select("id, title, url")
      .is("team_code", null)
      .order("published_at", { ascending: false })
      .limit(8);
    items = data ?? [];
  }

  const { data: rotate } = await db.from("app_settings").select("value").eq("key", "news.rotate_ms").maybeSingle();
  const rotateMs = typeof rotate?.value === "number" ? rotate.value : 5000;

  return (
    <section aria-label={heading} className="border border-[color:var(--color-border)]">
      <h2 className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase text-[color:var(--color-chrome)]">
        {heading}
      </h2>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-sm text-[color:var(--color-text-mid)]">{empty}</p>
      ) : (
        <NewsFader items={items} rotateMs={rotateMs} />
      )}
    </section>
  );
}
