import { anteForWeek, potSplitForCount } from "./constants";
import { computeMedian, houseLimit, isFelt } from "./core";
import type { EnginePlayer, SlateOpenResult } from "./types";

/** §14 steps 1–2, as one pure computation. Order inside matters and is the rulebook's:
 *  median first (pre-ante, felt and deactivated excluded), tier snapshot from the
 *  active count, felt evaluated once pre-ante, THEN antes, THEN post-ante limits. */
export function computeSlateOpen(players: EnginePlayer[], weekNumber: number): SlateOpenResult {
  const ante = anteForWeek(weekNumber);
  const active = players.filter((p) => p.status === "approved");

  const feltPlayerIds = new Set(active.filter((p) => isFelt(p.stackPreAnte, ante)).map((p) => p.id));

  const medianSnapshot = computeMedian(
    active.filter((p) => !feltPlayerIds.has(p.id)).map((p) => p.stackPreAnte),
  );

  const activeCountSnapshot = active.length; // felt counted; deactivated not (§7)
  const placesTierSnapshot = potSplitForCount(activeCountSnapshot).length;

  const entries: SlateOpenResult["entries"] = [];
  const houseLimits = new Map<string, number>();

  for (const p of active) {
    if (feltPlayerIds.has(p.id)) {
      // §9: no ante, no minimums; the limit is the entire stack.
      houseLimits.set(p.id, p.stackPreAnte);
      continue;
    }
    entries.push(
      { account: p.id, kind: "ante", amount: -ante, reason: `Week ${weekNumber} ante` },
      { account: null, kind: "ante", amount: ante, reason: `Week ${weekNumber} ante` },
    );
    // §9: a stack exactly equal to the ante pays it, hits zero, takes the floor chip
    // from the Pot, and lands on the felt THIS week — after being counted in the
    // median pre-ante, which is why this runs after the median snapshot.
    if (p.stackPreAnte - ante < 1) {
      const floorChip = 1 - (p.stackPreAnte - ante);
      entries.push(
        { account: p.id, kind: "felt_floor", amount: floorChip, reason: `Week ${weekNumber} — §9 floor after ante` },
        { account: null, kind: "felt_floor", amount: -floorChip, reason: `Week ${weekNumber} — §9 floor after ante` },
      );
      feltPlayerIds.add(p.id);
      houseLimits.set(p.id, 1);
    } else {
      houseLimits.set(p.id, houseLimit(p.stackPreAnte - ante, medianSnapshot));
    }
  }

  return { medianSnapshot, placesTierSnapshot, activeCountSnapshot, feltPlayerIds, entries, houseLimits };
}

/** One player's slate-open arithmetic, for a LATE admission into an open week (D-020,
 *  hardened per review D-036). Mirrors the per-player branch above exactly — the felt
 *  evaluation, the ante, the §9 floor when the ante lands a stack below 1, the limit
 *  from the FROZEN median — so the job layer cannot drift from the engine again: the
 *  drift was real (a reactivated stack equal to the ante was being anted to 0 with a
 *  0 limit, below the stack≥1 invariant, because the job's re-implementation lacked
 *  the floor branch). */
export function computeAdmission(
  stackPreAnte: number,
  ante: number,
  medianSnapshot: number,
): {
  felt: boolean;
  houseLimit: number;
  entries: SlateOpenResult["entries"];
} {
  if (isFelt(stackPreAnte, ante)) {
    // §9: no ante, no minimums; the limit is the entire stack.
    return { felt: true, houseLimit: stackPreAnte, entries: [] };
  }
  const entries: SlateOpenResult["entries"] = [
    { account: null, kind: "ante", amount: ante, reason: "admission ante — pot side" },
  ];
  // Player side first for readability at the call site.
  entries.unshift({ account: "self", kind: "ante", amount: -ante, reason: "admission ante" });
  if (stackPreAnte - ante < 1) {
    const floorChip = 1 - (stackPreAnte - ante);
    entries.push(
      { account: "self", kind: "felt_floor", amount: floorChip, reason: "§9 floor after ante" },
      { account: null, kind: "felt_floor", amount: -floorChip, reason: "§9 floor after ante" },
    );
    return { felt: true, houseLimit: 1, entries };
  }
  return { felt: false, houseLimit: houseLimit(stackPreAnte - ante, medianSnapshot), entries };
}
