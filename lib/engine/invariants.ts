import { STARTING_STACK } from "./constants";
import type { EngineLedgerEntry } from "./types";

// §8.12 — assert after every settlement. Any failure halts settlement, alerts the
// commissioner, and leaves the week unsettled rather than writing bad state.

export interface Balances {
  stacks: Map<string, number>;
  pot: number;
}

export function computeBalances(entries: EngineLedgerEntry[]): Balances {
  const stacks = new Map<string, number>();
  let pot = 0;
  for (const e of entries) {
    if (!Number.isInteger(e.amount)) throw new Error(`Non-integer chip amount: ${e.amount} (§4.4)`);
    if (e.account === null) pot += e.amount;
    else stacks.set(e.account, (stacks.get(e.account) ?? 0) + e.amount);
  }
  return { stacks, pot };
}

export class InvariantViolation extends Error {}

/** The conservation assertion. `buyInCount` counts players holding a buy_in entry —
 *  not everyone who ever created a row (§8.12). `closedWriteOffs` is the sum of
 *  season_close marker write-offs (§8.10), zero during the season. */
export function assertInvariants(entries: EngineLedgerEntry[], opts?: { closedWriteOffs?: number }): Balances {
  const balances = computeBalances(entries);
  const buyIns = entries.filter((e) => e.kind === "buy_in").length;
  const writeOffs = opts?.closedWriteOffs ?? 0;

  const total = [...balances.stacks.values()].reduce((a, b) => a + b, 0) + balances.pot;
  const expected = STARTING_STACK * buyIns + writeOffs;
  if (total !== expected) {
    throw new InvariantViolation(
      `Conservation failed: stacks+pot = ${total}, expected ${expected} (${buyIns} buy-ins). Nothing is created, nothing destroyed (§5).`,
    );
  }

  // §13 removal (D-041) is the one way an account legitimately reaches zero: the seat
  // no longer exists, so the §9 floor — which protects a PLAYER from being wiped out —
  // has nothing left to protect. Read the removed set off the ledger itself rather
  // than plumbing roster status down here: a removal is a debit of the player's whole
  // stack, and the append-only ledger is already the source of truth this function
  // trusts for everything else. The floor is replaced by a stricter test, not waived:
  // a removed seat must be EXACTLY empty. Half-drained is a redistribution bug.
  const removed = new Set(
    entries.filter((e) => e.kind === "removal" && e.account !== null && e.amount < 0).map((e) => e.account!),
  );

  for (const [player, stack] of balances.stacks) {
    if (removed.has(player)) {
      if (stack !== 0) {
        throw new InvariantViolation(
          `Removed seat ${player} holds ${stack} chips, not 0. A removal moves the whole stack or it is a leak (§13).`,
        );
      }
      continue;
    }
    if (stack < 1) {
      throw new InvariantViolation(`Stack below 1 for ${player}: ${stack}. The floor is absolute (§9).`);
    }
  }

  for (const e of entries) {
    if (!e.reason || e.reason.trim().length === 0) {
      throw new InvariantViolation("Ledger entry with empty reason (§8.12).");
    }
  }

  return balances;
}
