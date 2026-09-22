// Where a week's number actually came from (D-106).
//
// The week line shows the ledger's total for that week, but the rows underneath it
// are only the BETS — so a week where somebody won the Pot read "+231" over bets
// that plainly summed to +61, and there was no way to see that the missing 180 was
// the Pot and the missing 10 was the ante. Same arithmetic, now shown.
//
// Grouped the way a player thinks about it rather than the way the ledger stores it:
// a bet is three entries (stake out, stake back, profit) and the ante is two on a
// shove week (charged, refunded), so both collapse to one signed number each.

export interface WeekParts {
  bets: number;
  ante: number;
  pot: number;
  /** Corrections, the §9 floor chip, markers, the fold penalty — rare, never hidden. */
  other: number;
  total: number;
}

const BET_KINDS = new Set(["bet_stake", "bet_return", "bet_payout"]);
const ANTE_KINDS = new Set(["ante", "ante_refund", "ante_recharge"]);

export function weekParts(entries: Array<{ kind: string; amount: number }>): WeekParts {
  const parts: WeekParts = { bets: 0, ante: 0, pot: 0, other: 0, total: 0 };
  for (const e of entries) {
    parts.total += e.amount;
    if (BET_KINDS.has(e.kind)) parts.bets += e.amount;
    else if (ANTE_KINDS.has(e.kind)) parts.ante += e.amount;
    else if (e.kind === "pot_award") parts.pot += e.amount;
    else parts.other += e.amount;
  }
  return parts;
}
