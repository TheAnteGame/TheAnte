// Rule constants, from ANTE-RULEBOOK.md v1.1. Locked while a season is active (§13).
// The engine reads these; the admin settings surface renders them read-only mid-season.

/** §2 — the ante tiers. The clock. */
export const ANTE_TIERS = [
  { weeks: [1, 4] as const, ante: 10, tier: "purple" as const },
  { weeks: [5, 9] as const, ante: 15, tier: "red" as const },
  { weeks: [10, 14] as const, ante: 20, tier: "teal" as const },
  { weeks: [15, 18] as const, ante: 30, tier: "gold" as const },
];

export function anteForWeek(week: number): number {
  const t = ANTE_TIERS.find(({ weeks: [a, b] }) => week >= a && week <= b);
  if (!t) throw new Error(`No ante tier for week ${week}`);
  return t.ante;
}

export function tierForWeek(week: number): "purple" | "red" | "teal" | "gold" {
  const t = ANTE_TIERS.find(({ weeks: [a, b] }) => week >= a && week <= b);
  if (!t) throw new Error(`No tier for week ${week}`);
  return t.tier;
}

export const STARTING_STACK = 500; // §1
export const MIN_PLAYERS = 8; // §1 — to start, not to survive
export const LIMIT_DIVISOR = 3; // §4 — one-third
export const ROUNDING_STEP = 10; // §4, §14 — floor to nearest 10
export const MIN_GAMES = 5; // §3 — lifts on the felt / short stack
export const MIN_BET = 10; // §3
export const MAX_BET = 50; // §3
export const BET_STEP = 10; // §3 — becomes 1 on the felt (§9)

/** §5 — payout clamp, expressed as exact rationals so chip math never touches floats. */
export const PAYOUT_FLOOR = { num: 1, den: 4 }; // 0.25×
export const PAYOUT_CAP = { num: 5, den: 2 }; // 2.50×

/** §7 — places paid: one per eight players, snapshotted at slate open. */
export const POT_PLACES: ReadonlyArray<{ min: number; max: number; split: readonly number[] }> = [
  { min: 0, max: 15, split: [100] },
  { min: 16, max: 23, split: [67, 33] },
  { min: 24, max: 31, split: [50, 33, 17] },
  { min: 32, max: 39, split: [40, 30, 20, 10] },
  { min: 40, max: Infinity, split: [33, 27, 20, 13, 7] },
];

export function potSplitForCount(activeCount: number): readonly number[] {
  const row = POT_PLACES.find((r) => activeCount >= r.min && activeCount <= r.max);
  return row ? row.split : [100];
}
