// Plain-data types for the pure engine (ANTE-TECH §1: no I/O, no clock, no DB).
// The engine takes these in and returns EngineLedgerEntry[] and summaries out; the
// job layer translates to and from database rows.

export type PlayerStatus = "approved" | "deactivated";

export interface EnginePlayer {
  id: string;
  status: PlayerStatus;
  /** Stack at slate open, BEFORE this week's ante (§14 order of operations). */
  stackPreAnte: number;
  /** Held (null) or the week it was spent. */
  shoveUsedWeek: number | null;
}

export type BetSide = "away" | "home";

export interface EngineBet {
  gameId: string;
  side: BetSide;
  chips: number;
}

export interface EngineTicket {
  playerId: string;
  isFold: boolean;
  isShove: boolean;
  bets: EngineBet[]; // empty for folds; exactly one for shoves
  /** Shove only: the pre-ante stack, fixed at submission (§8.7). */
  committedStake: number | null;
  /** Shove only: the ante coming back at the reveal (§8.3). */
  pendingRefund: number | null;
}

export type GameOutcome =
  | { kind: "final"; winner: BetSide | "tie" }
  | { kind: "void"; reason: "cancelled" | "postponed" | "kicked_pre_deadline" };

export interface EngineGame {
  id: string;
  outcome: GameOutcome;
}

/** Two-sided ledger movement. account null = the Pot's own account (§9). buy_in is
 *  the single exception: one-sided, it mints the league's chips. Conservation is
 *  sum(all amounts) === 500 × buy-ins, checked by assertInvariants. */
export interface EngineLedgerEntry {
  account: string | null;
  kind:
    | "buy_in"
    | "ante"
    | "ante_refund"
    | "ante_recharge"
    | "bet_stake"
    | "bet_return"
    | "bet_payout"
    | "pot_award"
    | "felt_floor"
    | "marker"
    | "correction"
    | "reversal"
    | "sweep"
    | "season_close"
    | "removal";
  amount: number; // signed integer chips
  reason: string;
}

export interface SlateOpenResult {
  /** League median, pre-ante, felt and deactivated excluded, floored to 10 (§14). */
  medianSnapshot: number;
  /** Pot places tier from the active count (§7) — fixed for the week. */
  placesTierSnapshot: number;
  activeCountSnapshot: number;
  /** Player ids on the felt this week — evaluated once, here, pre-ante (§9). */
  feltPlayerIds: Set<string>;
  /** Ante entries (player debit + pot credit pairs). Empty for felt players. */
  entries: EngineLedgerEntry[];
  /** Post-ante house limit per player id (felt players: their whole stack). */
  houseLimits: Map<string, number>;
}

export interface BetSettlement {
  playerId: string;
  gameId: string;
  side: BetSide;
  chips: number;
  /** Exact rational multiplier after clamp; display as m.num/m.den to 2dp. */
  multiplier: { num: number; den: number };
  result: "won" | "lost" | "returned" | "void";
  /** Profit for wins (floored); 0 otherwise. Stake return is a separate entry. */
  payout: number;
}

export interface SettleWeekResult {
  bets: BetSettlement[];
  entries: EngineLedgerEntry[];
  /** Net stack change per player, ante included, before the Pot (§14). */
  gains: Map<string, number>;
  /** Chips the table didn't pay back — retained by the Pot this week. */
  swept: number;
  potAwards: Array<{ playerId: string; place: number; amount: number }>;
  /** Pot balance after award. Negative = the marker carries (§7). */
  potAfter: number;
  /** Shove tickets whose game voided: card returned, ante recharged (§14). */
  returnedShoves: string[];
}
