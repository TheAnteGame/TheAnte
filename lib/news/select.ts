// Which headlines the news box shows (D-099).
//
// The box used to take the eight most recent items for the team, which hands the
// whole box to whichever source publishes most often. Instead: one from each source
// in turn, newest first, then the next from each, and so on — every source that
// carries the team gets a turn before any source gets a second.
//
// Deliberately a ROTATION, not a shuffle. The dashboard re-renders every five
// seconds, so a random pick would deal a different eight on every poll and the
// fader would jump mid-headline. A rotation is stable between polls and still
// stops one prolific feed owning the box.

export interface NewsItem {
  id: string;
  title: string;
  url: string | null;
  sourceId: string | null;
  source: string | null;
}

export function rotateBySource(items: NewsItem[], limit: number): NewsItem[] {
  const groups = new Map<string, NewsItem[]>();
  for (const it of items) {
    const key = it.sourceId ?? "";
    const g = groups.get(key);
    if (g) g.push(it);
    else groups.set(key, [it]);
  }
  const lists = [...groups.values()];
  const out: NewsItem[] = [];
  for (let round = 0; out.length < limit; round++) {
    let placed = false;
    for (const list of lists) {
      const item = list[round];
      if (!item) continue;
      out.push(item);
      placed = true;
      if (out.length >= limit) break;
    }
    if (!placed) break;
  }
  return out;
}
