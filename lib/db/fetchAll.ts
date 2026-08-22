// PostgREST silently caps un-ranged selects (1,000 rows on Supabase defaults).
// A 25-player season ledger crosses that mid-season — the torture test caught
// settlement computing stacks from a truncated read. EVERY full-table read of
// ledger_entries (or anything unbounded) must page through this helper.
//
// Callers must include a stable .order(...) in the builder so pages don't shear.

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(`paged read failed: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) return out;
  }
}

// PostgREST filters travel in the URL, so a `.in("id", [...])` list of UUIDs blows the
// ~8KB request-line limit and returns 414 long before it returns rows: 215 uuids is the
// ceiling, which a 25-player league reaches in Week 9. Chunk any id list whose length
// grows with the season. Week-scoped lists (one week of tickets) are fine unchunked.
export const IN_CHUNK = 150;

export function chunk<T>(items: T[], size = IN_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
