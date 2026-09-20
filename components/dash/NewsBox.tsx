import { createUserClient } from "@/lib/db/supabase";
import { getContent } from "@/lib/content/getContent";
import { rotateBySource, type NewsItem } from "@/lib/news/select";
import { mentionsTeam } from "@/lib/news/mentions";
import { decodeEntities } from "@/lib/news/decode";
import { NewsFader } from "./NewsFader";
import { NewsSourcePicker } from "./NewsSourcePicker";

// Your team's headlines (ANTE-PLAYER §7) — always ABOUT your team, and from as many
// outlets as cover it (D-100). Two shapes feed it: the club's own feed, which tags
// its items with a team code, and the league desks (ESPN, CBS), which tag nothing
// and so are matched on the team's nickname. They then take turns, so the box reads
// as several reporters on one team rather than one press office (D-099). A player
// who prefers one outlet pins it from the menu underneath; pinning narrows WHO is
// reporting, never WHAT they report on. Commissioner curates only by hiding (§0).

const SHOW = 8;
const POOL = SHOW * 4;

export async function NewsBox({ playerId }: { playerId: string }) {
  const db = createUserClient();

  // The pinned source is read SEPARATELY, and on purpose. Asking for it in the same
  // select as favorite_team meant that on a database without migration 0031 the whole
  // row read failed and the box went blank — the team came back with it. Split, the
  // pin degrades to "no pin" and the headlines keep working.
  const [{ data: me }, pin, heading, empty, sourceLabel, pickLabel, allLabel] = await Promise.all([
    db.from("players").select("favorite_team").eq("id", playerId).maybeSingle(),
    db.from("players").select("news_source_id").eq("id", playerId).maybeSingle(),
    getContent("dash.news.heading"),
    getContent("dash.news.empty"),
    getContent("dash.news.source_label"),
    getContent("dash.news.pick_label"),
    getContent("dash.news.all_sources"),
  ]);
  const team = me?.favorite_team ?? null;
  const canPin = !pin.error;
  const pinned = canPin ? ((pin.data as { news_source_id?: string | null } | null)?.news_source_id ?? null) : null;

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
  let offered: Array<{ id: string; name: string }> = [];

  if (team) {
    const [{ data: teamRow }, { data: sourceRows }] = await Promise.all([
      db.from("teams").select("name").eq("code", team).maybeSingle(),
      // Every enabled source that can reach this player: the club's feed and the
      // league desks, which do cover the team — just without a tag on the row.
      db.from("feed_sources").select("id, name, kind, team_code").eq("enabled", true).order("name"),
    ]);
    const nickname = (teamRow?.name as string | undefined) ?? "";
    offered = (sourceRows ?? [])
      .filter((s) => s.team_code === team || s.kind === "league_ticker")
      .map((s) => ({ id: s.id, name: s.name }));

    const [tagged, league] = await Promise.all([
      base().eq("team_code", team),
      // ilike is the cheap prefilter; mentionsTeam is what actually decides, because
      // "%Rams%" also finds Jalen Ramsey.
      nickname ? base().is("team_code", null).ilike("title", `%${nickname}%`) : Promise.resolve({ data: [] as Row[] }),
    ]);

    const pool = [
      ...named(tagged.data as Row[] | null),
      ...named((league.data as Row[] | null) ?? []).filter((r) => mentionsTeam(r.title, nickname)),
    ]
      .filter((r) => !pinned || r.sourceId === pinned)
      .sort((a, b) => b.at.localeCompare(a.at));

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
        <NewsFader items={items} sourceLabel={sourceLabel} />
      )}
      {/* Only when there is a choice to make AND the pin can actually be saved — a
          dropdown that silently does nothing is worse than no dropdown. */}
      {canPin && offered.length > 1 && (
        <NewsSourcePicker label={pickLabel} allLabel={allLabel} current={pinned} sources={offered} />
      )}
    </section>
  );
}
