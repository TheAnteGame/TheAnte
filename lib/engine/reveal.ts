import type { EngineLedgerEntry, EngineTicket } from "./types";

/** Whether the week is in a fit state to be opened (§6; hardened per review D-036).
 *
 *  The one impossible-to-honor state is a DEALT-IN room with zero tickets: players
 *  were anted in but nobody has a ticket — revealing would burn their week, so the
 *  caller must fold or wait first. (revealDeadline auto-folds before calling, which
 *  is why this is unreachable on the deadline path.)
 *
 *  Everything else reveals — deliberately including a week with NO dealt-in players
 *  at its deadline: an empty week that cannot gain players (admission closes at the
 *  deadline) must complete and let the season advance, because slate.open refuses to
 *  reopen an existing week and a refusal here would wedge the season permanently.
 *  The empty-room-pre-deadline case (the original D-034 bug: zero players read as
 *  "everybody is in") is the caller's to guard — revealCheck skips when nobody is
 *  dealt in, so only the deadline can complete an empty week. */
export function canReveal(input: { dealtIn: number; tickets: number }): { ok: true } | { ok: false; reason: string } {
  if (input.dealtIn > 0 && input.tickets === 0) {
    return { ok: false, reason: "dealt-in players but no tickets — fold or wait before revealing" };
  }
  return { ok: true };
}

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
