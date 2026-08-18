import type { EngineLedgerEntry, EngineTicket } from "./types";

/** §6, §8.3 — the reveal posts every deferred entry atomically. NOTHING posts to the
 *  ledger between the ante and this moment: bet stakes and a shove's ante refund are
 *  computed at submission, stored on the ticket, and land here — so no public figure
 *  can twitch while the blackout is on. */
export function revealEntries(tickets: EngineTicket[], weekNumber: number): EngineLedgerEntry[] {
  const entries: EngineLedgerEntry[] = [];
  for (const t of tickets) {
    if (t.isFold) continue;

    if (t.isShove) {
      // The refund comes out of the Pot at the reveal, not at submission (§8.3).
      const refund = t.pendingRefund ?? 0;
      if (refund > 0) {
        entries.push(
          { account: t.playerId, kind: "ante_refund", amount: refund, reason: `Week ${weekNumber} shove — ante refunded` },
          { account: null, kind: "ante_refund", amount: -refund, reason: `Week ${weekNumber} shove — ante refunded` },
        );
      }
      const stake = t.committedStake ?? 0;
      entries.push(
        { account: t.playerId, kind: "bet_stake", amount: -stake, reason: `Week ${weekNumber} shove stake` },
        { account: null, kind: "bet_stake", amount: stake, reason: `Week ${weekNumber} shove stake` },
      );
      continue;
    }

    for (const b of t.bets) {
      entries.push(
        { account: t.playerId, kind: "bet_stake", amount: -b.chips, reason: `Week ${weekNumber} stake` },
        { account: null, kind: "bet_stake", amount: b.chips, reason: `Week ${weekNumber} stake` },
      );
    }
  }
  return entries;
}
