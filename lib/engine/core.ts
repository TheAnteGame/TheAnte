import { LIMIT_DIVISOR, PAYOUT_CAP, PAYOUT_FLOOR, ROUNDING_STEP } from "./constants";

export function floorTo10(n: number): number {
  return Math.floor(n / ROUNDING_STEP) * ROUNDING_STEP;
}

/** §14 — the median. Caller passes PRE-ANTE stacks of approved, non-felt players.
 *  Average the middle two when even, then round down to the nearest 10 — odd counts
 *  round too; no special case. */
export function computeMedian(stacks: number[]): number {
  if (stacks.length === 0) return 0;
  const sorted = [...stacks].sort((a, b) => a - b);
  const n = sorted.length;
  const mid = n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  return floorTo10(mid);
}

/** §4 — one-third of the smaller of your own POST-ANTE stack or the PRE-ANTE league
 *  median, floored to 10. The two moments differ on purpose (ANTE-PLAYER §1.5):
 *  measuring your own stack pre-ante would let a short stack risk more than a third
 *  of what it actually holds. This reads like an inconsistency and is not one. */
export function houseLimit(ownStackAfterAnte: number, medianBeforeAntes: number): number {
  return floorTo10(Math.min(ownStackAfterAnte, medianBeforeAntes) / LIMIT_DIVISOR);
}

/** §9 — felt: below one full ante, evaluated once per week at slate open, pre-ante. */
export function isFelt(stackPreAnte: number, ante: number): boolean {
  return stackPreAnte < ante;
}

/** §5 — payout = against ÷ with, clamped to [0.25, 2.50]; nobody on the other side
 *  settles at even money. Exact rational — floats never touch chip math (§4.4). */
export function multiplierFor(withCount: number, againstCount: number): { num: number; den: number } {
  if (withCount <= 0) throw new Error("with-count includes the bettor and can never be zero (§5)");
  if (againstCount === 0) return { num: 1, den: 1 };
  // raw = against/with; clamp by cross-multiplication to stay in integers
  if (againstCount * PAYOUT_FLOOR.den < withCount * PAYOUT_FLOOR.num) return { ...PAYOUT_FLOOR };
  if (againstCount * PAYOUT_CAP.den > withCount * PAYOUT_CAP.num) return { ...PAYOUT_CAP };
  const g = gcd(againstCount, withCount);
  return { num: againstCount / g, den: withCount / g };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** §14 — every payout floors to a whole chip; the remainder joins the Pot. */
export function profitFor(stake: number, multiplier: { num: number; den: number }): number {
  return Math.floor((stake * multiplier.num) / multiplier.den);
}

/** Display form: two decimals with a true ×, e.g. "2.50×", "0.67×" (art §4). */
export function formatMultiplier(m: { num: number; den: number }): string {
  return `${(m.num / m.den).toFixed(2)}×`;
}
