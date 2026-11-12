import type { EngineLedgerEntry, SideAccount } from "./types";

// Side-game money (D-131 rules, D-132 settlement door). Pure: given one game's result
// from ANTE Play, the pool's balance and each entrant's stack, return the exact ledger
// rows. ANTE Play decides WHO won; this decides WHAT MOVES. Nothing here touches the
// Pot — every row is a player, a pool, or the house.

export type SideGame = "bingo" | "crunch";
export const SIDE_GAMES: readonly SideGame[] = ["bingo", "crunch"];
export const SIDE_GAME_NAMES: Record<SideGame, string> = { bingo: "Gridiron Bingo", crunch: "Crunch Time" };

/** D-131 rule 1. */
export const SIDE_GAME_ENTRY = 10;
/** D-131 rule 8: the last side-game week; any pool left after it goes to the house. */
export const SIDE_GAMES_LAST_WEEK = 18;
/** Rule 9 ("can't cover it") read against the §9 floor: the entry must leave the
 *  stack at 1 or more, or a losing entrant would sit at 0 — a stack §9 forbids and
 *  the conservation assertion refuses. So 10 to enter means 11 to be eligible. */
export const SIDE_GAME_MIN_STACK = SIDE_GAME_ENTRY + 1;

export const poolAccount = (game: SideGame): SideAccount => (game === "bingo" ? "play_pool_bingo" : "play_pool_crunch");

/** Every side-game kind starts with play_. Weekly gain (§14) and every Pot figure
 *  leave these out (D-132): a side game moves a stack, never the main game's result. */
export const isSideGameKind = (kind: string): boolean => kind.startsWith("play_");

/** The idempotency-key prefix for one game in one week. Every row of that game
 *  carries it plus a role suffix, so a repeat post collides on the unique index. */
export const sideGameKeyPrefix = (game: SideGame, week: number) => `play:${game}:${week}`;

export class SideGameError extends Error {}

export interface SideGameRow {
  /** A player row, or null for a side-account row. */
  playerId: string | null;
  /** The side account, or null for a player row. Exactly one of the two is set. */
  account: SideAccount | null;
  kind: "play_entry" | "play_payout" | "play_house";
  amount: number;
  reason: string;
  idempotencyKey: string;
}

export interface SideGameInput {
  game: SideGame;
  week: number;
  /** ANTE Play's entrants (ante player ids). */
  entrants: string[];
  /** Tiers, best → worst; a tier with more than one id is a tie. */
  order: string[][];
  /** Only meaningful with exactly one entrant. */
  soloWon: boolean | null;
  /** The pool's balance before this week's rows. */
  poolBefore: number;
  /** Each entrant's stack at posting time. Missing = 0. */
  stacks: ReadonlyMap<string, number>;
}

export type SideGameMode = "none" | "contested" | "solo_win" | "solo_loss" | "no_contest";

export interface SideGamePlan {
  game: SideGame;
  week: number;
  mode: SideGameMode;
  /** Entrants whose entry is taken. */
  eligible: string[];
  /** Entrants who could not cover the entry (rule 9) — cancelled, nothing taken. */
  dropped: string[];
  winners: string[];
  /** Chips each winner receives (0 when nobody wins). */
  payoutEach: number;
  /** Contested only: entries plus the rollover — what the winners split. */
  prize: number;
  poolBefore: number;
  poolAfter: number;
  /** Net change to the house from this game (negative = the house paid). */
  houseDelta: number;
  /** Week 18 only: chips swept from the pool to the house after the game (rule 8). */
  swept: number;
  rows: SideGameRow[];
}

export function planSideGame(input: SideGameInput): SideGamePlan {
  const { game, week, order, soloWon, poolBefore } = input;
  if (!SIDE_GAMES.includes(game)) throw new SideGameError(`Unknown side game "${game}".`);
  if (!Number.isInteger(week) || week < 1 || week > SIDE_GAMES_LAST_WEEK) {
    throw new SideGameError(`Week ${week} is outside the side-game season (1–${SIDE_GAMES_LAST_WEEK}).`);
  }
  if (!Number.isInteger(poolBefore) || poolBefore < 0) throw new SideGameError(`Pool balance ${poolBefore} is not a whole, non-negative number.`);

  const entrants = [...input.entrants];
  if (new Set(entrants).size !== entrants.length) throw new SideGameError(`${SIDE_GAME_NAMES[game]}: an entrant is listed twice.`);
  const entrantSet = new Set(entrants);
  const ranked = new Set<string>();
  for (const tier of order) {
    for (const id of tier) {
      if (!entrantSet.has(id)) throw new SideGameError(`${SIDE_GAME_NAMES[game]}: the order names ${id}, who did not enter.`);
      if (ranked.has(id)) throw new SideGameError(`${SIDE_GAME_NAMES[game]}: ${id} appears twice in the order.`);
      ranked.add(id);
    }
  }

  const stackOf = (id: string) => input.stacks.get(id) ?? 0;
  const eligible = entrants.filter((id) => stackOf(id) >= SIDE_GAME_MIN_STACK);
  const dropped = entrants.filter((id) => stackOf(id) < SIDE_GAME_MIN_STACK);
  const eligibleSet = new Set(eligible);

  const name = SIDE_GAME_NAMES[game];
  const prefix = sideGameKeyPrefix(game, week);
  const pool = poolAccount(game);
  const rows: SideGameRow[] = [];
  const playerRow = (playerId: string, kind: SideGameRow["kind"], amount: number, reason: string, role: string) =>
    rows.push({ playerId, account: null, kind, amount, reason, idempotencyKey: `${prefix}:${role}` });
  const accountRow = (account: SideAccount, kind: SideGameRow["kind"], amount: number, reason: string, role: string) =>
    rows.push({ playerId: null, account, kind, amount, reason, idempotencyKey: `${prefix}:${role}` });

  const n = eligible.length;
  let mode: SideGameMode = "none";
  let winners: string[] = [];
  let payoutEach = 0;
  let prize = 0;
  let poolAfter = poolBefore;
  let houseDelta = 0;

  const takeEntries = () => {
    for (const id of eligible) playerRow(id, "play_entry", -SIDE_GAME_ENTRY, `${name}, Week ${week} — entry`, "entry");
    accountRow(pool, "play_entry", SIDE_GAME_ENTRY * n, `${name}, Week ${week} — ${n} entr${n === 1 ? "y" : "ies"} into the pool`, "pool-in");
    poolAfter += SIDE_GAME_ENTRY * n;
  };

  if (n >= 2) {
    // Rule 4/5: everyone plays everyone; the first tier that still has someone in it
    // wins. Dropped entrants are gone from the order and the tiers close up (rule 9).
    const tier = order.map((t) => t.filter((id) => eligibleSet.has(id))).find((t) => t.length > 0);
    if (!tier) throw new SideGameError(`${name}, Week ${week}: none of the ${n} eligible entrants is ranked — refusing to guess a winner.`);
    mode = "contested";
    takeEntries();
    prize = SIDE_GAME_ENTRY * n + poolBefore;
    winners = [...tier];
    payoutEach = Math.floor(prize / winners.length);
    for (const id of winners) {
      playerRow(
        id,
        "play_payout",
        payoutEach,
        winners.length > 1 ? `${name}, Week ${week} — ${winners.length}-way tie, a share of ${prize}` : `${name}, Week ${week} — won ${prize}`,
        "payout",
      );
    }
    accountRow(pool, "play_payout", -payoutEach * winners.length, `${name}, Week ${week} — paid to ${winners.length} winner${winners.length === 1 ? "" : "s"}`, "pool-out");
    poolAfter -= payoutEach * winners.length; // the remainder stays: next week's rollover
  } else if (n === 1) {
    const solo = eligible[0];
    // A one-entrant game whose result ANTE Play scored as contested (somebody else
    // entered and was dropped) has no target to have hit. Nothing is taken and
    // nothing paid — the same as rule 9 for the dropped player.
    if (entrants.length > 1) {
      mode = "no_contest";
    } else if (soloWon === null) {
      throw new SideGameError(`${name}, Week ${week}: one entrant, but ANTE Play sent no solo result — refusing to guess.`);
    } else {
      // Rule 6: one entrant plays the house. The rollover is never touched.
      takeEntries();
      if (soloWon) {
        mode = "solo_win";
        winners = [solo];
        payoutEach = SIDE_GAME_ENTRY * 2;
        playerRow(solo, "play_payout", payoutEach, `${name}, Week ${week} — beat the house`, "payout");
        accountRow(pool, "play_payout", -SIDE_GAME_ENTRY, `${name}, Week ${week} — entry back to the solo winner`, "pool-out");
        accountRow("play_house", "play_house", -SIDE_GAME_ENTRY, `${name}, Week ${week} — the house pays the solo winner`, "house");
        poolAfter -= SIDE_GAME_ENTRY;
        houseDelta -= SIDE_GAME_ENTRY;
      } else {
        mode = "solo_loss";
        accountRow(pool, "play_house", -SIDE_GAME_ENTRY, `${name}, Week ${week} — solo entry lost to the house`, "pool-to-house");
        accountRow("play_house", "play_house", SIDE_GAME_ENTRY, `${name}, Week ${week} — the house takes the solo entry`, "house");
        poolAfter -= SIDE_GAME_ENTRY;
        houseDelta += SIDE_GAME_ENTRY;
      }
    }
  }
  // n === 0: rule 7, nothing happens and any rollover waits.

  // Rule 8: after the last week's game, whatever is left in the pool goes to the house.
  let swept = 0;
  if (week === SIDE_GAMES_LAST_WEEK && poolAfter > 0) {
    swept = poolAfter;
    accountRow(pool, "play_house", -swept, `${name} — season over, ${swept} left in the pool to the house`, "sweep-pool");
    accountRow("play_house", "play_house", swept, `${name} — season over, the pool's last ${swept} to the house`, "sweep-house");
    poolAfter = 0;
    houseDelta += swept;
  }

  const net = rows.reduce((s, r) => s + r.amount, 0);
  if (net !== 0) throw new SideGameError(`${name}, Week ${week}: rows sum to ${net}, not 0 — refusing (§5).`);
  if (poolAfter < 0) throw new SideGameError(`${name}, Week ${week}: the pool would end at ${poolAfter}.`);

  return { game, week, mode, eligible, dropped, winners, payoutEach, prize, poolBefore, poolAfter, houseDelta, swept, rows };
}

export interface SideGameResult {
  game: SideGame;
  entrants: string[];
  order: string[][];
  soloWon: boolean | null;
}

/** A whole week, both games, in a fixed order (bingo, then crunch). Each game sees the
 *  stacks the previous one left behind, so a player in both games can't spend the
 *  same 10 twice. In Week 18 a game nobody entered still sweeps its pool. */
export function planSideGameWeek(input: {
  week: number;
  games: SideGameResult[];
  pools: Partial<Record<SideAccount, number>>;
  stacks: ReadonlyMap<string, number>;
  /** Games already on the ledger for this week — planned as nothing. */
  skip?: ReadonlySet<SideGame>;
}): SideGamePlan[] {
  const seen = new Set<string>();
  for (const g of input.games) {
    if (seen.has(g.game)) throw new SideGameError(`${SIDE_GAME_NAMES[g.game] ?? g.game} appears twice in the week's results.`);
    seen.add(g.game);
  }
  const stacks = new Map(input.stacks);
  const plans: SideGamePlan[] = [];
  for (const game of SIDE_GAMES) {
    if (input.skip?.has(game)) continue;
    const r = input.games.find((g) => g.game === game) ?? { game, entrants: [], order: [], soloWon: null };
    const plan = planSideGame({
      game,
      week: input.week,
      entrants: r.entrants,
      order: r.order,
      soloWon: r.soloWon,
      poolBefore: input.pools[poolAccount(game)] ?? 0,
      stacks,
    });
    for (const row of plan.rows) if (row.playerId) stacks.set(row.playerId, (stacks.get(row.playerId) ?? 0) + row.amount);
    plans.push(plan);
  }
  return plans;
}

/** The engine's view of a side-game row, for assertInvariants. */
export function sideRowToEngine(r: SideGameRow): EngineLedgerEntry {
  return { account: r.playerId, side: r.account, kind: r.kind, amount: r.amount, reason: r.reason };
}
