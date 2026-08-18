import { DateTime } from "luxon";
import { createUserClient } from "@/lib/db/supabase";
import { fetchAllRows } from "@/lib/db/fetchAll";
import { getContent } from "@/lib/content/getContent";
import { ET } from "@/lib/time";
import { TickerMarquee, type TickerItem } from "./TickerMarquee";

// The blended rail (ADMIN §0, §4.5): one ordered list a player never has to parse —
// manual posts, system league facts, and feed headlines. Stored rows (manual/feed)
// come from ticker_items; system items are computed here at render on the same poll
// cadence, worded by content blocks, and obey the blackout: waiting_on carries
// names only and stops the moment the reveal fires (§6).

export async function Ticker() {
  const db = createUserClient();

  const [{ data: settingsRows }, { data: stored }, { data: week }] = await Promise.all([
    db.from("app_settings").select("key, value").in("key", ["ticker.enabled", "ticker.max_items", "ticker.system_items"]),
    db
      .from("ticker_items")
      .select("id, source, text, url, pinned, priority, starts_at, ends_at, created_at")
      .eq("hidden", false),
    db
      .from("weeks")
      .select("id, number, phase, deadline_at, revealed_at, marker")
      .in("phase", ["open", "revealed", "settled"])
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const settings = new Map((settingsRows ?? []).map((r) => [r.key, r.value]));
  if (settings.get("ticker.enabled") === false) return null;
  const maxItems = typeof settings.get("ticker.max_items") === "number" ? (settings.get("ticker.max_items") as number) : 12;
  const sysToggles = (settings.get("ticker.system_items") ?? {}) as Record<string, boolean>;
  const sysOn = (key: string) => sysToggles[key] !== false;

  const now = new Date();
  const eligible = (stored ?? []).filter(
    (t) =>
      (!t.starts_at || new Date(t.starts_at) <= now) && (!t.ends_at || new Date(t.ends_at) > now),
  );

  // System items — league facts, generated on the poll cadence (ADMIN §4.5.3).
  const system: Array<{ text: string; priority: number }> = [];
  if (week) {
    const potBalance = (
      await fetchAllRows<{ amount: number; player_id: string | null }>((f, t) =>
        db.from("ledger_entries").select("amount, player_id").is("player_id", null).order("id").range(f, t),
      )
    ).reduce((s, e) => s + e.amount, 0);

    if (week.phase === "open" && sysOn("deadline")) {
      const deadline = DateTime.fromISO(week.deadline_at).setZone(ET);
      const diff = deadline.diff(DateTime.now().setZone(ET), ["days", "hours"]);
      if (diff.toMillis() > 0) {
        const remaining = `${Math.floor(diff.days)}d ${Math.floor(diff.hours)}h`;
        system.push({ text: await getContent("ticker.deadline", { remaining }), priority: 3 });
      }
    }
    if (week.phase === "open" && !week.revealed_at && sysOn("waiting_on")) {
      const { data: waiting } = await db.from("waiting_on").select("first_name, last_name, submitted");
      const out = (waiting ?? []).filter((w) => !w.submitted);
      if (out.length > 0 && (waiting ?? []).length > 0) {
        system.push({
          text: await getContent("ticker.waiting_on", {
            in: (waiting ?? []).length - out.length,
            total: (waiting ?? []).length,
            names: out.map((w) => `${w.first_name ?? ""} ${(w.last_name ?? "").slice(0, 1)}.`.trim()).join(", "),
          }),
          priority: 2,
        });
      }
    }
    if (sysOn("pot")) system.push({ text: await getContent("ticker.pot", { pot: potBalance }), priority: 1 });
    if (week.marker > 0 && sysOn("marker")) {
      system.push({ text: await getContent("ticker.marker", { marker: week.marker }), priority: 2 });
    }
    if (
      week.phase === "revealed" &&
      week.revealed_at &&
      DateTime.fromISO(week.revealed_at).plus({ hours: 6 }) > DateTime.now() &&
      sysOn("reveal")
    ) {
      system.push({ text: await getContent("ticker.reveal"), priority: 2 });
    }
    if (sysOn("leader")) {
      const { data: top } = await db.from("standings").select("first_name, last_name, stack, status").eq("rank", 1).limit(1);
      const leader = (top ?? []).find((t) => t.status === "approved");
      if (leader) {
        system.push({
          text: await getContent("ticker.leader", {
            name: `${leader.first_name ?? ""} ${(leader.last_name ?? "").slice(0, 1)}.`.trim(),
            stack: leader.stack ?? 0,
          }),
          priority: 0,
        });
      }
    }
  }

  // Ordering (ADMIN §4.5.1): pinned, priority, source rank (manual > system > feed), recency.
  const sourceRank = { manual: 2, system: 1, feed: 0 } as const;
  const merged: TickerItem[] = [
    ...eligible.map((t) => ({
      id: t.id,
      text: t.text,
      url: t.url,
      source: t.source as "manual" | "feed",
      sort: [t.pinned ? 1 : 0, t.priority, sourceRank[t.source as "manual" | "feed"] ?? 0, new Date(t.created_at).getTime()],
    })),
    ...system.map((s, i) => ({
      id: `sys-${i}`,
      text: s.text,
      url: null,
      source: "system" as const,
      sort: [0, s.priority, sourceRank.system, 0],
    })),
  ]
    .sort((a, b) => {
      for (let i = 0; i < 4; i++) if (a.sort[i] !== b.sort[i]) return b.sort[i] - a.sort[i];
      return 0;
    })
    .slice(0, maxItems)
    .map(({ id, text, url, source }) => ({ id, text, url, source }));

  // Guardrail: an empty rail does not render at all (ADMIN §4.5.1).
  if (merged.length === 0) return null;

  return <TickerMarquee items={merged} />;
}
