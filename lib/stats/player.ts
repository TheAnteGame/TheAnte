// One player's season, as numbers (D-104).
//
// The three dials answer "how does this person actually bet", which is the whole
// point of being able to open somebody's profile: how WIDE they go against the
// five-game minimum, how HEAVY they go against the 10–50 range, and how CONTRARIAN
// they are — the multiplier they earn, which runs 0.25× on the popular side to
// 2.50× alone against the room (§5).
//
// Folds and shoves are excluded from the width and weight dials on purpose. A fold
// has no bets to average and would drag width to zero; a shove is a single forced
// all-in at even money (§8) and would drag weight to the ceiling. Both are still
// counted and shown on their own.

export interface ProfileBet {
  chips: number;
  multiplier: number | null;
  result: string | null;
  payout: number | null;
}

export interface ProfileTicket {
  week: number;
  isFold: boolean;
  isShove: boolean;
  bets: ProfileBet[];
}

export interface Dials {
  /** Revealed weeks with a ticket of any kind, folds included. */
  weeksPlayed: number;
  weeksFolded: number;
  weeksShoved: number;
  /** Across live, non-shove tickets only — null when there are none yet. */
  avgGames: number | null;
  avgChips: number | null;
  /** Chip-weighted, so a big bet at 2.5× counts for more than a token one. */
  avgMultiplier: number | null;
  biggestBet: number | null;
  totalStaked: number;
  betsWon: number;
  betsLost: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function playerDials(tickets: ProfileTicket[]): Dials {
  const live = tickets.filter((t) => !t.isFold && !t.isShove);
  const allBets = tickets.flatMap((t) => t.bets);
  const liveBets = live.flatMap((t) => t.bets);

  let weightedMultiplier = 0;
  let weightedChips = 0;
  for (const b of allBets) {
    // A returned or void bet never priced, so it says nothing about how they bet.
    if (b.multiplier === null || b.result === "returned" || b.result === "void") continue;
    weightedMultiplier += b.multiplier * b.chips;
    weightedChips += b.chips;
  }

  return {
    weeksPlayed: tickets.length,
    weeksFolded: tickets.filter((t) => t.isFold).length,
    weeksShoved: tickets.filter((t) => t.isShove).length,
    avgGames: live.length > 0 ? round1(liveBets.length / live.length) : null,
    avgChips: liveBets.length > 0 ? round1(liveBets.reduce((s, b) => s + b.chips, 0) / liveBets.length) : null,
    avgMultiplier: weightedChips > 0 ? round2(weightedMultiplier / weightedChips) : null,
    biggestBet: allBets.length > 0 ? Math.max(...allBets.map((b) => b.chips)) : null,
    totalStaked: allBets.reduce((s, b) => s + b.chips, 0),
    betsWon: allBets.filter((b) => b.result === "won").length,
    betsLost: allBets.filter((b) => b.result === "lost").length,
  };
}
