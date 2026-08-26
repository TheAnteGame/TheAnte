import type { EngineLedgerEntry } from "./types";

// §14, the deadweight rule (D-041). A seat that has not submitted a ticket for three
// straight weeks may be removed, and its whole stack goes back to the table in equal
// shares. The arithmetic lives here rather than in the admin action for the reason the
// rest of this directory exists: the job layer must not be able to drift from the
// engine. The torture test drives this same function.
//
// Chips are whole (§4.4), so the share is floored and the leftover — always strictly
// fewer chips than there are recipients — goes to the Pot to be won, rather than to
// whichever player happened to sort first. The Pot is already where odd chips live
// (the §9 felt floor is paid out of it).

export class RemovalError extends Error {}

export interface RemovalPlan {
  entries: EngineLedgerEntry[];
  /** Chips each remaining player receives. */
  share: number;
  /** Chips to the Pot: stack − share × recipients. Always < recipients.length. */
  remainder: number;
}

export function computeRemoval(opts: {
  playerId: string;
  /** The removed seat's stack, a SUM projection of the append-only ledger. */
  stack: number;
  /** Approved players still in the league, excluding the removed one. */
  recipientIds: readonly string[];
  /** Human label for the ledger reason, e.g. "Terry M." */
  who: string;
}): RemovalPlan {
  const { playerId, stack, recipientIds, who } = opts;

  if (!Number.isInteger(stack)) throw new RemovalError(`Non-integer stack: ${stack} (§4.4)`);
  if (stack < 0) throw new RemovalError(`Refusing to redistribute a negative stack: ${stack}`);
  if (recipientIds.length === 0) throw new RemovalError("No recipients — a removal with nobody left would destroy chips (§5)");
  if (recipientIds.includes(playerId)) throw new RemovalError("The removed player cannot be their own recipient");

  const share = Math.floor(stack / recipientIds.length);
  const remainder = stack - share * recipientIds.length;

  const entries: EngineLedgerEntry[] = [
    {
      account: playerId,
      kind: "removal",
      amount: -stack,
      reason: "Removed under the deadweight rule (§14) — stack redistributed",
    },
  ];

  if (share > 0) {
    for (const id of recipientIds) {
      entries.push({
        account: id,
        kind: "removal",
        amount: share,
        reason: `Even share of ${who} stack on removal (§14)`,
      });
    }
  }

  if (remainder > 0) {
    entries.push({
      account: null,
      kind: "removal",
      amount: remainder,
      reason: `Remainder of ${who} stack to the Pot on removal (§14)`,
    });
  }

  // A redistribution that does not net to zero is not a redistribution. D-023 was a
  // commissioner correction that moved ~8,000 chips while every total still balanced,
  // so this asserts the movement itself, not just the books afterwards.
  const net = entries.reduce((sum, e) => sum + e.amount, 0);
  if (net !== 0) throw new RemovalError(`Redistribution does not balance: net ${net}`);

  return { entries, share, remainder };
}
