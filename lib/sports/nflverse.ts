import { kickoffFromNflverse } from "@/lib/time";
import { parseCsv } from "./csv";
import type { GameRow, SpreadRow } from "./types";

// nflverse games.csv — Lee Sharpe's dataset, republished via GitHub Actions. Plain
// CSV over HTTPS, no key, no rate limit (ANTE-TECH §3.1 / DECISIONS D-005). Its
// `espn` column is the maintained cross-reference that makes the ESPN live layer a
// join instead of a mapping we'd have to own.

const GAMES_CSV_URL = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv";

export interface NflverseFetch {
  games: GameRow[];
  spreads: SpreadRow[];
  finals: Map<string, { awayScore: number; homeScore: number }>;
  /** Raw rows for job_runs.detail — when Week 9 settles wrong, the argument is about
   *  what the feed actually said (ANTE-TECH §3.1). */
  raw: Array<Record<string, string>>;
}

export async function fetchNflverseWeek(season: number, week: number): Promise<NflverseFetch> {
  const res = await fetch(GAMES_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`nflverse fetch failed: ${res.status}`);
  const rows = parseCsv(await res.text()).filter(
    (r) => r.season === String(season) && r.game_type === "REG" && r.week === String(week),
  );
  if (rows.length === 0) throw new Error(`nflverse: no REG rows for ${season} week ${week}`);

  const games: GameRow[] = rows.map((r) => ({
    externalId: r.game_id,
    espnId: r.espn || null,
    season,
    week,
    awayTeam: r.away_team,
    homeTeam: r.home_team,
    kickoffAt: kickoffFromNflverse(r.gameday, r.gametime),
  }));

  const spreads: SpreadRow[] = rows.map((r) => ({
    externalId: r.game_id,
    spreadLine: r.spread_line === "" ? null : Number(r.spread_line),
  }));

  const finals = new Map<string, { awayScore: number; homeScore: number }>();
  for (const r of rows) {
    if (r.away_score !== "" && r.home_score !== "") {
      finals.set(r.game_id, { awayScore: Number(r.away_score), homeScore: Number(r.home_score) });
    }
  }

  return { games, spreads, finals, raw: rows };
}
