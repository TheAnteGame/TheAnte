import { anteForWeek } from "./constants";

// Season awards (§12) and championship tiebreakers (§11), as pure computation.
// Deactivated players are ineligible for the championship and every award — they
// keep their stack and their standings row (§11).

export interface SeasonTicket {
  week: number;
  playerId: string;
  isFold: boolean;
  isShove: boolean;
  /** Submission instant, ms. Auto-folds carry the deadline-time insert — the latest
   *  anyone can be, which is exactly what §12 wants for the Straggler. */
  submittedAtMs: number;
}

export interface SeasonBet {
  playerId: string;
  week: number;
  chips: number;
  /** Applied multiplier as a decimal (bets.multiplier). */
  multiplier: number | null;
  result: "won" | "lost" | "returned" | "void";
  isShove: boolean;
}

export interface SeasonPlayer {
  id: string;
  status: "approved" | "deactivated";
  finalStack: number;
  /** Ever landed on the felt during the season (week_players.felt any week). */
  everOnFelt: boolean;
}

export interface AwardsInput {
  players: SeasonPlayer[];
  tickets: SeasonTicket[];
  bets: SeasonBet[];
  /** gain per player per week — net including ante, before the Pot (§14). */
  weeklyGains: Array<{ playerId: string; week: number; gain: number }>;
  potsWon: Array<{ playerId: string; count: number }>;
  weeksPlayed: number[];
}

export interface AwardResult {
  playerIds: string[];
  detail: string;
}

export function computeAwards(input: AwardsInput): Record<string, AwardResult> {
  const eligible = input.players.filter((p) => p.status === "approved");
  const ids = new Set(eligible.map((p) => p.id));
  const awards: Record<string, AwardResult> = {};

  // The Iron Stack — never folded a single week; forgetting counts as folding.
  const foldedBy = new Map<string, number>();
  for (const t of input.tickets) {
    if (t.isFold) foldedBy.set(t.playerId, (foldedBy.get(t.playerId) ?? 0) + 1);
  }
  const iron = eligible.filter((p) => (foldedBy.get(p.id) ?? 0) === 0 && input.tickets.some((t) => t.playerId === p.id));
  if (iron.length > 0) awards.iron_stack = { playerIds: iron.map((p) => p.id), detail: "Zero folds, all season" };

  // The Chalk Eater — highest share of chips on sides paying under 1×. Not a compliment.
  let chalkBest: { id: string; share: number } | null = null;
  for (const p of eligible) {
    const decided = input.bets.filter((b) => b.playerId === p.id && (b.result === "won" || b.result === "lost") && b.multiplier !== null);
    const total = decided.reduce((s, b) => s + b.chips, 0);
    if (total === 0) continue;
    const chalk = decided.filter((b) => (b.multiplier ?? 1) < 1).reduce((s, b) => s + b.chips, 0);
    const share = chalk / total;
    if (!chalkBest || share > chalkBest.share) chalkBest = { id: p.id, share };
  }
  if (chalkBest && chalkBest.share > 0) {
    awards.chalk_eater = { playerIds: [chalkBest.id], detail: `${Math.round(chalkBest.share * 100)}% of chips on the popular side` };
  }

  // Contrarian of the Year — most winning bets at 2.00×+. A shove pays 1× and never qualifies.
  let contrarian: { id: string; count: number } | null = null;
  for (const p of eligible) {
    const count = input.bets.filter(
      (b) => b.playerId === p.id && b.result === "won" && !b.isShove && (b.multiplier ?? 0) >= 2,
    ).length;
    if (count > 0 && (!contrarian || count > contrarian.count)) contrarian = { id: p.id, count };
  }
  if (contrarian) awards.contrarian = { playerIds: [contrarian.id], detail: `${contrarian.count} winning bets at 2.00× or better` };

  // Best Week — largest single-week gain.
  let best: { id: string; week: number; gain: number } | null = null;
  for (const g of input.weeklyGains) {
    if (!ids.has(g.playerId)) continue;
    if (!best || g.gain > best.gain) best = { id: g.playerId, week: g.week, gain: g.gain };
  }
  if (best && best.gain > 0) awards.best_week = { playerIds: [best.id], detail: `+${best.gain} in Week ${best.week}` };

  // Worst Shove — self-explanatory. Trophy travels.
  let worst: { id: string; week: number; stake: number } | null = null;
  for (const b of input.bets) {
    if (!b.isShove || b.result !== "lost" || !ids.has(b.playerId)) continue;
    if (!worst || b.chips > worst.stake) worst = { id: b.playerId, week: b.week, stake: b.chips };
  }
  if (worst) awards.worst_shove = { playerIds: [worst.id], detail: `${worst.stake} chips, gone, Week ${worst.week}` };

  // The Straus — reached the felt and climbed back above 500.
  const straus = eligible.filter((p) => p.everOnFelt && p.finalStack > 500);
  if (straus.length > 0) awards.straus = { playerIds: straus.map((p) => p.id), detail: "A chip and a chair" };

  // The Straggler — last to submit the most weeks; never submitting counts as last.
  const lastCount = new Map<string, number>();
  for (const week of input.weeksPlayed) {
    const weekTickets = input.tickets.filter((t) => t.week === week && ids.has(t.playerId));
    if (weekTickets.length === 0) continue;
    const latest = Math.max(...weekTickets.map((t) => t.submittedAtMs));
    for (const t of weekTickets) {
      if (t.submittedAtMs === latest) lastCount.set(t.playerId, (lastCount.get(t.playerId) ?? 0) + 1);
    }
  }
  let straggler: { id: string; count: number } | null = null;
  for (const [id, count] of lastCount) {
    if (!straggler || count > straggler.count) straggler = { id, count };
  }
  if (straggler) awards.straggler = { playerIds: [straggler.id], detail: `Held up the reveal ${straggler.count} times` };

  return awards;
}

// ── Championship order (§11, §8.9) — before the high card ────────────────────────
export interface FinalStanding {
  playerId: string;
  stack: number;
  winningBets: number; // shove wins count 1; returns and voids neither
  potsWon: number;
  weeksFolded: number;
  eligible: boolean; // deactivated players keep the row, not the title
}

export function championshipOrder(standings: FinalStanding[]): FinalStanding[] {
  return [...standings].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.stack !== b.stack) return b.stack - a.stack;
    if (a.winningBets !== b.winningBets) return b.winningBets - a.winningBets;
    if (a.potsWon !== b.potsWon) return b.potsWon - a.potsWon;
    if (a.weeksFolded !== b.weeksFolded) return a.weeksFolded - b.weeksFolded;
    return 0; // a surviving tie goes to the high card (§8.9)
  });
}

/** §12 — The Mark's electorate: players who finished on the felt (below one Week 18 ante). */
export function finishedOnFelt(finalStack: number): boolean {
  return finalStack < anteForWeek(18);
}
