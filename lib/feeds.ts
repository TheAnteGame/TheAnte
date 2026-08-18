import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobOutcome } from "./jobs/util";

// feeds.sync (ANTE-ADMIN §5): ingest RSS/Atom items from enabled sources every 15
// minutes. League-ticker items are projected into ticker_items with source='feed';
// team-news items feed the Fav Team News box. Provider-agnostic, no vendor.

interface FeedEntry {
  externalId: string;
  title: string;
  url: string | null;
  publishedAt: string | null;
}

function textBetween(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return null;
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

/** Tolerant RSS 2.0 / Atom parser — titles, links, dates. Nothing else is needed. */
export function parseFeed(xml: string): FeedEntry[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  return blocks
    .map((block) => {
      const title = textBetween(block, "title");
      if (!title) return null;
      // Atom: <link href="…"/>; RSS: <link>…</link>
      const atomLink = block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? null;
      const url = atomLink ?? textBetween(block, "link");
      const published = textBetween(block, "pubDate") ?? textBetween(block, "published") ?? textBetween(block, "updated");
      const guid = textBetween(block, "guid") ?? textBetween(block, "id") ?? url ?? title;
      let publishedAt: string | null = null;
      if (published) {
        const d = new Date(published);
        if (!Number.isNaN(d.getTime())) publishedAt = d.toISOString();
      }
      return { externalId: guid, title: title.slice(0, 300), url, publishedAt };
    })
    .filter((e): e is FeedEntry => e !== null);
}

export async function feedsSync(db: SupabaseClient): Promise<JobOutcome> {
  const { data: sources } = await db.from("feed_sources").select("*").eq("enabled", true);
  if (!sources || sources.length === 0) return { status: "skipped", detail: { reason: "no enabled sources" } };

  let ingested = 0;
  const errors: Array<{ source: string; error: string }> = [];

  for (const source of sources) {
    try {
      const res = await fetch(source.url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const entries = parseFeed(await res.text()).slice(0, 25);

      for (const e of entries) {
        const { data: inserted, error } = await db
          .from("feed_items")
          .upsert(
            {
              source_id: source.id,
              external_id: e.externalId,
              title: e.title,
              url: e.url,
              published_at: e.publishedAt,
              team_code: source.team_code,
            },
            { onConflict: "external_id", ignoreDuplicates: true },
          )
          .select("id");
        if (!error && inserted && inserted.length > 0) {
          ingested++;
          // League-wide sources project into the ticker rail (ADMIN §4.5.2).
          if (source.kind === "league_ticker") {
            await db.from("ticker_items").insert({
              source: "feed",
              feed_item_id: inserted[0].id,
              text: e.title.slice(0, 140),
              url: e.url,
              priority: source.priority,
            });
          }
        }
      }
      await db
        .from("feed_sources")
        .update({ last_fetched_at: new Date().toISOString(), last_status: "ok", last_error: null })
        .eq("id", source.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ source: source.name, error: msg });
      await db
        .from("feed_sources")
        .update({ last_fetched_at: new Date().toISOString(), last_status: "error", last_error: msg })
        .eq("id", source.id);
    }
  }

  return { status: errors.length === sources.length ? "failed" : "succeeded", detail: { ingested, errors } };
}
