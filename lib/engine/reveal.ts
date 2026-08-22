import type { EngineLedgerEntry, EngineTicket } from "./types";

/** Whether the room is in a fit state to be opened at all (§6).
 *
 *  The reveal decides by asking who it is still waiting on: active players minus those
 *  who submitted. That subtraction cannot tell "nobody is left to wait for" apart from
 *  "everybody is in" — so an EMPTY room reported itself as unanimously ready and
 *  revealed a week with no players and no tickets, burning it (the week cannot reopen:
 *  slate.open skips a week that already exists).
 *
 *  Deliberately this is the only bar. A league that has shrunk mid-season still reveals:
 *  §1's eight-player minimum is "to start, not to survive", and refusing to reveal a
 *  small-but-real room would freeze the week instead of playing it, which is worse. */
export function canReveal(input: { activePlayers: number; tickets: number }): { ok: true } | { ok: false; reason: string } {
  if (input.activePlayers === 0) return { ok: false, reason: "no active players — an empty room is not a unanimous one" };
  if (input.tickets === 0) return { ok: false, reason: "no tickets — there is nothing to reveal" };
  return { ok: true };
}

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
