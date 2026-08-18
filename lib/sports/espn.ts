import type { GameStatus, StatusRow } from "./types";

// ESPN public scoreboard — live status and scores ONLY. Never spreads, never the
// canonical id, never the sole record of a final (ANTE-TECH §3.1). Joined to our
// rows through nflverse's `espn` column.

interface EspnEvent {
  id: string;
  status?: { type?: { name?: string } };
  competitions?: Array<{
    competitors?: Array<{ homeAway?: string; score?: string }>;
  }>;
}

function mapStatus(name: string | undefined): GameStatus {
  if (!name) return "scheduled";
  if (name === "STATUS_FINAL" || name === "STATUS_FULL_TIME") return "final";
  if (name === "STATUS_SCHEDULED" || name === "STATUS_POSTPONED" || name === "STATUS_DELAYED") return "scheduled";
  return "in_progress"; // in progress, halftime, end period, OT — live football
}

export interface EspnFetch {
  /** Keyed by ESPN event id (games.espn_id). */
  statuses: Map<string, StatusRow>;
  raw: unknown;
}

export async function fetchEspnWeek(season: number, week: number): Promise<EspnFetch> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${season}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN fetch failed: ${res.status}`);
  const data = (await res.json()) as { events?: EspnEvent[] };

  const statuses = new Map<string, StatusRow>();
  for (const e of data.events ?? []) {
    const comp = e.competitions?.[0]?.competitors ?? [];
    const away = comp.find((c) => c.homeAway === "away");
    const home = comp.find((c) => c.homeAway === "home");
    const status = mapStatus(e.status?.type?.name);
    statuses.set(e.id, {
      externalId: e.id, // ESPN id here; the caller re-keys to games.external_id
      status,
      awayScore: away?.score != null && status !== "scheduled" ? Number(away.score) : null,
      homeScore: home?.score != null && status !== "scheduled" ? Number(home.score) : null,
    });
  }

  return { statuses, raw: { eventCount: data.events?.length ?? 0 } };
}
