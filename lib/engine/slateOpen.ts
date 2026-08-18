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
