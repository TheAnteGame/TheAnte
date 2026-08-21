// Live league analysis (D-022). Pure functions, no I/O — same shape as lib/engine.
//
// Every metric here is one the season awards (§12) already judge, computed the same
// way and simply shown from Week 1 instead of only at the close. That is deliberate:
// players should be able to see all season exactly what they are being measured on,
// in the rulebook's own vocabulary, rather than statistics invented for a dashboard.
//
// BLACKOUT: callers must pass rows from REVEALED weeks only. Everything here is a
// projection of settled history, so nothing can move between the ante and the reveal
// (§6) — the standings view sets the same precedent with `w.revealed_at is not null`.

export interface StatBet {
  playerId: string;
  week: number;
  chips: number;
  /** bets.multiplier, the applied price. Null until the week settles. */
  multiplier: number | null;
  result: "won" | "lost" | "returned" | "void";
  isShove: boolean;
  /** The team actually backed, for tendencies. */
  team: string;
}

export interface StatTicket {
  playerId: string;
  week: number;
  isFold: boolean;
}

export interface WeeklyGain {
  playerId: string;
  week: number;
  /** Net change for the week, ante included, before the Pot (§14). */
  gain: number;
}

export interface PlayerTendency {
  playerId: string;
  decided: number;
  won: number;
  lost: number;
  winPct: number | null;
  /** Share of decided CHIPS placed on the popular side. The Chalk Eater metric (§12). */
  chalkShare: number | null;
  /** Wins at 2.00× or better. The Contrarian metric (§12). */
  bigPriceWins: number;
  avgMultiplier: number | null;
  folds: number;
  bestWeek: { week: number; gain: number } | null;
  /** Most-backed team, and how many times. */
  favourite: { team: string; times: number } | null;
}

const DECIDED = new Set(["won", "lost"]);

/** A bet priced under 1× was on the popular side — the same test §12 uses. */
const wasChalk = (b: StatBet) => (b.multiplier ?? 1) < 1;

export function playerTendencies(
  playerIds: string[],
  bets: StatBet[],
  tickets: StatTicket[],
  gains: WeeklyGain[],
): PlayerTendency[] {
  return playerIds.map((id) => {
    const mine = bets.filter((b) => b.playerId === id && DECIDED.has(b.result));
    const won = mine.filter((b) => b.result === "won").length;
    const lost = mine.filter((b) => b.result === "lost").length;
    const decided = won + lost;

    const chipsDecided = mine.reduce((s, b) => s + b.chips, 0);
    const chipsChalk = mine.filter(wasChalk).reduce((s, b) => s + b.chips, 0);

    const multipliers = mine.map((b) => b.multiplier).filter((m): m is number => m !== null);

    const teamCounts = new Map<string, number>();
    for (const b of bets.filter((x) => x.playerId === id)) {
      teamCounts.set(b.team, (teamCounts.get(b.team) ?? 0) + 1);
    }
    const favourite = [...teamCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    const myGains = gains.filter((g) => g.playerId === id);
    const best = myGains.reduce<WeeklyGain | null>((acc, g) => (!acc || g.gain > acc.gain ? g : acc), null);

    return {
      playerId: id,
      decided,
      won,
      lost,
      winPct: decided > 0 ? Math.round((won / decided) * 100) : null,
      chalkShare: chipsDecided > 0 ? chipsChalk / chipsDecided : null,
      bigPriceWins: mine.filter((b) => b.result === "won" && (b.multiplier ?? 0) >= 2).length,
      avgMultiplier: multipliers.length > 0 ? multipliers.reduce((s, m) => s + m, 0) / multipliers.length : null,
      folds: tickets.filter((t) => t.playerId === id && t.isFold).length,
      bestWeek: best && best.gain > 0 ? { week: best.week, gain: best.gain } : null,
      favourite: favourite ? { team: favourite[0], times: favourite[1] } : null,
    };
  });
}

export interface Highlight<T> {
  value: T;
  playerId?: string;
  week: number;
}

export interface LeagueHighlights {
  /** Largest chip gain in the most recent settled week — what the Pot pays for (§7). */
  biggestWeek: Highlight<number> | null;
  /** Highest price actually cashed that week. The reward for fading the room. */
  bestPrice: Highlight<{ multiplier: number; chips: number; team: string }> | null;
  /** The most-backed side that lost — aimed at the matchup, never at a player. */
  coldestTake: Highlight<{ team: string; backers: number }> | null;
  /** Longest current run of positive weeks, season to date. */
  hotHand: Highlight<number> | null;
}

export function leagueHighlights(bets: StatBet[], gains: WeeklyGain[]): LeagueHighlights {
  const weeks = [...new Set(gains.map((g) => g.week))].sort((a, b) => b - a);
  const latest = weeks[0];
  if (latest === undefined) {
    return { biggestWeek: null, bestPrice: null, coldestTake: null, hotHand: null };
  }

  const weekGains = gains.filter((g) => g.week === latest);
  const top = weekGains.reduce<WeeklyGain | null>((acc, g) => (!acc || g.gain > acc.gain ? g : acc), null);

  const weekBets = bets.filter((b) => b.week === latest);
  const winners = weekBets.filter((b) => b.result === "won" && b.multiplier !== null && !b.isShove);
  const best = winners.reduce<StatBet | null>(
    (acc, b) => (!acc || (b.multiplier ?? 0) > (acc.multiplier ?? 0) ? b : acc),
    null,
  );

  // The team the most people backed and lost on. A crowd being wrong together is the
  // funniest thing that happens in this game, and it names no one.
  const lostByTeam = new Map<string, number>();
  for (const b of weekBets.filter((x) => x.result === "lost")) {
    lostByTeam.set(b.team, (lostByTeam.get(b.team) ?? 0) + 1);
  }
  const cold = [...lostByTeam.entries()].sort((a, b) => b[1] - a[1])[0];

  // Longest run of positive weeks ending at the latest week played.
  let hot: Highlight<number> | null = null;
  for (const playerId of new Set(gains.map((g) => g.playerId))) {
    const mine = gains.filter((g) => g.playerId === playerId).sort((a, b) => b.week - a.week);
    let run = 0;
    for (const g of mine) {
      if (g.gain > 0) run++;
      else break;
    }
    if (run > 0 && (!hot || run > hot.value)) hot = { value: run, playerId, week: latest };
  }

  return {
    biggestWeek: top && top.gain > 0 ? { value: top.gain, playerId: top.playerId, week: latest } : null,
    bestPrice: best
      ? {
          value: { multiplier: best.multiplier!, chips: best.chips, team: best.team },
          playerId: best.playerId,
          week: latest,
        }
      : null,
    coldestTake: cold ? { value: { team: cold[0], backers: cold[1] }, week: latest } : null,
    hotHand: hot,
  };
}

export interface HeadToHead {
  opponentId: string;
  /** Weeks this player out-gained the opponent. */
  won: number;
  lost: number;
  tied: number;
  weeks: number;
}

/** Your record against every other player, week by week (D-026).
 *
 *  No chips change hands and none ever will: this is the rivalry without the side
 *  market. A peer-to-peer wager would route around the house limit §4 exists to
 *  enforce, count toward the weekly gain the Pot is paid on (§7, §14), and open the
 *  only chip-transfer channel the settlement engine does not control — which is
 *  precisely what makes the ledger worth trusting. A record costs none of that.
 *
 *  Only weeks where BOTH players have a result count, so somebody who joined in
 *  week 6 is not scored against weeks they could not play. */
export function headToHead(playerId: string, gains: WeeklyGain[]): HeadToHead[] {
  const mine = new Map(gains.filter((g) => g.playerId === playerId).map((g) => [g.week, g.gain]));
  const opponents = [...new Set(gains.map((g) => g.playerId))].filter((id) => id !== playerId);

  return opponents
    .map((opponentId) => {
      let won = 0;
      let lost = 0;
      let tied = 0;
      for (const g of gains.filter((x) => x.playerId === opponentId)) {
        const ours = mine.get(g.week);
        if (ours === undefined) continue;
        if (ours > g.gain) won++;
        else if (ours < g.gain) lost++;
        else tied++;
      }
      return { opponentId, won, lost, tied, weeks: won + lost + tied };
    })
    .filter((r) => r.weeks > 0)
    .sort((a, b) => b.won - a.won || a.lost - b.lost);
}
