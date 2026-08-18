import { multiplierFor, profitFor } from "./core";
import type {
  BetSettlement,
  EngineGame,
  EngineLedgerEntry,
  EngineTicket,
  SettleWeekResult,
} from "./types";

export interface SettleWeekInput {
  weekNumber: number;
  tickets: EngineTicket[];
  games: EngineGame[];
  /** Per player: stack at slate open pre-ante, and entering settlement (after the
   *  ante, reveal stakes, and any shove refund). Gains = after − preAnte (§14). */
  players: Array<{ id: string; stackPreAnte: number; stackAtReveal: number }>;
  /** Pot account balance entering settlement — this week's antes net of refunds,
   *  plus staked chips, plus anything rolled or carried from prior weeks. */
  potBalance: number;
  /** The split snapshotted at slate open (§7) — never recomputed at award time. */
  potSplit: readonly number[];
}

/** §14 steps 6–8: settle straight-up, recharge voided shoves, floor the felt from the
 *  Pot, then award the Pot from its own balance — which is what makes marker paydown
 *  and rollovers automatic: a negative balance awards nothing and carries (§7). */
export function settleWeek(input: SettleWeekInput): SettleWeekResult {
  const { weekNumber, tickets, games, players, potSplit } = input;
  const gameById = new Map(games.map((g) => [g.id, g]));
  const entries: EngineLedgerEntry[] = [];
  const bets: BetSettlement[] = [];
  const returnedShoves: string[] = [];

  // §5 — head counts per game side, from players who bet THAT game. Shovers count (§14).
  const heads = new Map<string, { away: number; home: number }>();
  for (const t of tickets) {
    if (t.isFold) continue;
    for (const b of t.bets) {
      const h = heads.get(b.gameId) ?? { away: 0, home: 0 };
      h[b.side] += 1;
      heads.set(b.gameId, h);
    }
  }

  const post = (playerId: string, kind: EngineLedgerEntry["kind"], amount: number, reason: string) => {
    entries.push(
      { account: playerId, kind, amount, reason },
      { account: null, kind, amount: -amount, reason },
    );
  };

  for (const t of tickets) {
    if (t.isFold) continue;
    for (const b of t.bets) {
      const game = gameById.get(b.gameId);
      if (!game) throw new Error(`Bet references unknown game ${b.gameId}`);
      const h = heads.get(b.gameId)!;
      const withCount = h[b.side];
      const againstCount = b.side === "away" ? h.home : h.away;
      // A shove always pays even money — no multiplier, ever (§8).
      const multiplier = t.isShove ? { num: 1, den: 1 } : multiplierFor(withCount, againstCount);

      let result: BetSettlement["result"];
      let payout = 0;

      if (game.outcome.kind === "void") {
        result = game.outcome.reason === "kicked_pre_deadline" ? "void" : "returned";
        post(t.playerId, "bet_return", b.chips, `Week ${weekNumber} — ${result} (${game.outcome.reason})`);
        if (t.isShove) {
          // §14: the shove didn't happen. Chips back (above), card back, and the
          // refunded ante is charged again — the exemption existed only because a
          // shover had nothing left to ante with, and now they do.
          returnedShoves.push(t.playerId);
          const recharge = t.pendingRefund ?? 0;
          if (recharge > 0) {
            post(t.playerId, "ante_recharge", -recharge, `Week ${weekNumber} — shove voided, ante recharged`);
          }
        }
      } else if (game.outcome.winner === "tie") {
        result = "returned";
        post(t.playerId, "bet_return", b.chips, `Week ${weekNumber} — tie, chips returned`);
      } else if (game.outcome.winner === b.side) {
        result = "won";
        payout = profitFor(b.chips, multiplier);
        post(t.playerId, "bet_return", b.chips, `Week ${weekNumber} — stake returned`);
        post(t.playerId, "bet_payout", payout, `Week ${weekNumber} — win at ${multiplier.num}/${multiplier.den}`);
      } else {
        result = "lost"; // full amount, regardless of what it would have paid (§5)
      }

      bets.push({ playerId: t.playerId, gameId: b.gameId, side: b.side, chips: b.chips, multiplier, result, payout });
    }
  }

  // Stacks after bet settlement; §9 floor — the last chip is DEBITED FROM THE POT.
  const settlementDelta = new Map<string, number>();
  for (const e of entries) {
    if (e.account) settlementDelta.set(e.account, (settlementDelta.get(e.account) ?? 0) + e.amount);
  }
  const stackAfter = new Map<string, number>();
  for (const p of players) stackAfter.set(p.id, p.stackAtReveal + (settlementDelta.get(p.id) ?? 0));

  for (const p of players) {
    const s = stackAfter.get(p.id)!;
    if (s < 1) {
      const floorChip = 1 - s;
      post(p.id, "felt_floor", floorChip, `Week ${weekNumber} — §9 floor: the last chip, from the Pot`);
      stackAfter.set(p.id, 1);
    }
  }

  // §14 — gain: net stack change including the ante, BEFORE the Pot is awarded.
  const gains = new Map<string, number>();
  for (const p of players) gains.set(p.id, stackAfter.get(p.id)! - p.stackPreAnte);

  // Sweep: whatever the table didn't pay back stays in the Pot (§5). Reported, not
  // re-posted — the chips are already sitting in the Pot's account.
  let staked = 0;
  let returned = 0;
  for (const b of bets) {
    staked += b.chips;
    if (b.result !== "lost") returned += b.chips;
    returned += b.payout;
  }
  const swept = staked - returned;

  // Pot balance after settlement movements (returns, payouts, recharges, floors all
  // carried a pot side in `post`).
  let potBalance = input.potBalance;
  for (const e of entries) if (e.account === null) potBalance += e.amount;

  // §7 — award. Eligibility: submitted a live ticket (folders out; a ticket whose
  // games all returned still counts). Distinct gain levels take places in order;
  // ties split that place's share evenly, floored; every leftover chip rolls.
  const eligible = new Set(tickets.filter((t) => !t.isFold).map((t) => t.playerId));
  const potAwards: SettleWeekResult["potAwards"] = [];

  if (potBalance > 0 && eligible.size > 0) {
    const pool = potBalance;
    const byGain = new Map<number, string[]>();
    for (const id of eligible) {
      const g = gains.get(id);
      if (g === undefined) continue;
      byGain.set(g, [...(byGain.get(g) ?? []), id]);
    }
    const levels = [...byGain.keys()].sort((a, b) => b - a);
    let awarded = 0;
    potSplit.forEach((pct, i) => {
      const level = levels[i];
      if (level === undefined) return; // fewer gain levels than places: share rolls
      const group = byGain.get(level)!;
      const share = Math.floor((pool * pct) / 100);
      const each = Math.floor(share / group.length);
      if (each <= 0) return;
      for (const id of group.sort()) {
        post(id, "pot_award", each, `Week ${weekNumber} — Pot, place ${i + 1}`);
        potAwards.push({ playerId: id, place: i + 1, amount: each });
        awarded += each;
      }
    });
    potBalance -= awarded;
  }
  // potBalance <= 0: nobody wins one this week; the marker (or the rolled Pot) carries.

  return { bets, entries, gains, swept, potAwards, potAfter: potBalance, returnedShoves };
}
