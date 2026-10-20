import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { rotateBySource, type NewsItem } from "@/lib/news/select";
import { mentionsTeam } from "@/lib/news/mentions";
import { decodeEntities } from "@/lib/news/decode";
import { NewsFader } from "./NewsFader";

// Your team's headlines (ANTE-PLAYER §7) — always ABOUT your team, and from as many
// outlets as cover it (D-100). Two shapes feed it: the club's own feed, which tags
// its items with a team code, and the league desks (ESPN, CBS), which tag nothing
// and so are matched on the team's nickname. They then take turns, so the box reads
// as several reporters on one team rather than one press office (D-099).
// Commissioner curates only by hiding (§0).
//
// The "Read from" menu is gone (D-114): owner's call, it was not worth the space. Any
// pin a player saved before is IGNORED, not honoured — with no menu there would be no
// way to undo it, and they would be stuck on one outlet. players.news_source_id stays
// in the schema, unused, in case the choice moves to the profile page later.

const SHOW = 8;
const POOL = SHOW * 4;

export async function NewsBox({ playerId }: { playerId: string }) {
  const db = createUserClient();

  const [{ data: me }, heading, empty, sourceLabel] = await Promise.all([
    db.from("players").select("favorite_team").eq("id", playerId).maybeSingle(),
    getContent("dash.news.heading"),
    getContent("dash.news.empty"),
    getContent("dash.news.source_label"),
  ]);
  const team = me?.favorite_team ?? null;

  type Row = {
    id: string;
    title: string;
    url: string | null;
    source_id: string | null;
    published_at: string | null;
    feed_sources: { name: string } | { name: string }[] | null;
  };
  const named = (rows: Row[] | null): Array<NewsItem & { at: string }> =>
    (rows ?? []).map((r) => ({
      id: r.id,
      title: decodeEntities(r.title),
      url: r.url,
      sourceId: r.source_id,
      source: (Array.isArray(r.feed_sources) ? r.feed_sources[0]?.name : r.feed_sources?.name) ?? null,
      at: r.published_at ?? "",
    }));
  const base = () =>
    db
      .from("feed_items")
      .select("id, title, url, source_id, published_at, feed_sources(name)")
      .order("published_at", { ascending: false })
      .limit(POOL);

  let items: NewsItem[] = [];

  if (team) {
    const { data: teamRow } = await db.from("teams").select("name").eq("code", team).maybeSingle();
    const nickname = (teamRow?.name as string | undefined) ?? "";

    const [tagged, league] = await Promise.all([
      base().eq("team_code", team),
      // ilike is the cheap prefilter; mentionsTeam is what actually decides, because
      // "%Rams%" also finds Jalen Ramsey.
      nickname ? base().is("team_code", null).ilike("title", `%${nickname}%`) : Promise.resolve({ data: [] as Row[] }),
    ]);

    const pool = [
      ...named(tagged.data as Row[] | null),
      ...named((league.data as Row[] | null) ?? []).filter((r) => mentionsTeam(r.title, nickname)),
    ].sort((a, b) => b.at.localeCompare(a.at));

    items = rotateBySource(pool, SHOW);
  }

  return (
    <section aria-label={heading} className="panel">
      <h2 className="panel-head px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-heading)]">
        {heading}
      </h2>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-sm text-[color:var(--color-text-mid)]">{empty}</p>
      ) : (
        // Opens on a different headline — so a different outlet — each page load
        // (D-114). The rotation itself stays stable; only where it starts moves,
        // because always opening on the most recent outlet read as "it never rotates".
        // eslint-disable-next-line react-hooks/purity -- a server render, once per request; varying per load is the point
        <NewsFader items={items} sourceLabel={sourceLabel} startAt={Math.floor(Date.now() / 1000)} />
      )}
    </section>
  );
}
