import { multiplierFor, profitFor } from "./core";
import type { BetSide, GameOutcome } from "./types";

// The weekend projection (D-075) — what a week looks like BEFORE it settles.
//
// Nothing here writes, and nothing here is authoritative. Settlement remains the one
// event that moves a chip, on Monday, exactly as before. This exists so the four days
// of football are not a blank screen: as each game goes final the board can move, and
// the room can watch the race instead of waiting for it.
//
// It must agree with settleWeek or it is worse than useless — a player told they are
// up 80 on Sunday and down 20 on Monday will not trust the ledger again. So it calls
// the SAME multiplierFor and profitFor, reads the same head counts, applies the same
// §8 shove rule, and treats a void the same way. The differences are deliberate and
// listed:
//
//   - Undecided bets are carried as "at risk", neither won nor lost.
//   - The §9 felt floor is NOT applied. It is a settlement action and the projection
//     has no business inventing the Pot's chip early.
//   - The Pot award is NOT projected. It depends on every player's final gain, so it
//     cannot be known until the last game is in — and it is the Monday surprise.

export interface ProjectionBet {
  gameId: string;
  side: BetSide;
  chips: number;
}

export interface ProjectionTicket {
  playerId: string;
  isShove: boolean;
  bets: ProjectionBet[];
}

/** A game the projection can reason about. `pending` is the state settleWeek never
 *  sees, because it refuses to run until every game is final. */
export type ProjectionOutcome = GameOutcome | { kind: "pending" };

export interface PlayerProjection {
  /** Profit already earned on games that are in. Floored per bet, as settlement pays. */
  profit: number;
  /** Stakes on games already lost. Gone — a losing bet loses the full amount (§5). */
  lost: number;
  /** Stakes on games not yet decided. Still theirs until a game says otherwise. */
  atRisk: number;
  /** Stakes that will come back: everything except the losses. */
  returnable: number;
  /** Bets decided so far, and the total on the ticket. */
  decided: number;
  total: number;
}

/** Per-player projection for one week. Head counts come from EVERY ticket, so the
 *  multipliers match the board exactly — they were fixed when the last ticket landed
 *  and cannot move again. */
export function projectWeek(input: {
  tickets: ProjectionTicket[];
  outcomes: Map<string, ProjectionOutcome>;
}): Map<string, PlayerProjection> {
  const heads = new Map<string, { away: number; home: number }>();
  for (const t of input.tickets) {
    for (const b of t.bets) {
      const h = heads.get(b.gameId) ?? { away: 0, home: 0 };
      h[b.side] += 1;
      heads.set(b.gameId, h);
    }
  }

  const out = new Map<string, PlayerProjection>();
  for (const t of input.tickets) {
    const p: PlayerProjection = { profit: 0, lost: 0, atRisk: 0, returnable: 0, decided: 0, total: t.bets.length };

    for (const b of t.bets) {
      const outcome = input.outcomes.get(b.gameId) ?? { kind: "pending" };

      if (outcome.kind === "pending") {
        p.atRisk += b.chips;
        p.returnable += b.chips;
        continue;
      }

      p.decided += 1;

      // A void or a postponement returns the stake and pays nothing. Cancellation is
      // not folding and it is not a loss (§7).
      if (outcome.kind === "void" || outcome.winner === "tie") {
        p.returnable += b.chips;
        continue;
      }

      if (outcome.winner === b.side) {
        const h = heads.get(b.gameId) ?? { away: 0, home: 0 };
        const against = b.side === "away" ? h.home : h.away;
        // §8 — a shove is even money, never the crowd price. The same rule settleWeek
        // applies, and the same one the reveal board had to be corrected for.
        const m = t.isShove ? { num: 1, den: 1 } : multiplierFor(h[b.side], against);
        p.profit += profitFor(b.chips, m);
        p.returnable += b.chips;
        continue;
      }

      // Lost: the full stake, regardless of what it would have paid (§5).
      p.lost += b.chips;
    }

    out.set(t.playerId, p);
  }
  return out;
}
