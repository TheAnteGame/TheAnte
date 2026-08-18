// Internal sports-data types (ANTE-TECH §3.1). No provider shape crosses this
// boundary — nflverse and ESPN payloads are mapped to these and nothing else,
// which is what makes the SportsDataIO fallback a new file rather than a refactor.

export interface GameRow {
  /** Canonical id — nflverse game_id, e.g. "2026_01_KC_BAL". Stored as games.external_id. */
  externalId: string;
  /** ESPN game id, from nflverse's `espn` column. Used only to join live status. */
  espnId: string | null;
  season: number;
  week: number;
  awayTeam: string; // nflverse team code — matches the seeded teams table
  homeTeam: string;
  kickoffAt: Date; // built from gameday/gametime in America/New_York
}

export interface SpreadRow {
  externalId: string;
  /** Home-favored positive, away-favored negative. Display context ONLY — never settles (§1.5). */
  spreadLine: number | null;
}

export type GameStatus = "scheduled" | "in_progress" | "final";

export interface StatusRow {
  externalId: string;
  status: GameStatus;
  awayScore: number | null;
  homeScore: number | null;
}
