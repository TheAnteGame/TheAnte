import { potSplitForCount } from "@/lib/engine";

// "How did Frank win the week?" — the Pot is the one number the room will argue about,
// and until now nothing on any screen answered it: the settled panel named the winner
// and the amount and stopped there.
//
// This reconstructs the award exactly as settleWeek performed it (§7/§14), from the
// ledger the settlement already wrote. It is a RE-DERIVATION, not a second opinion:
// the ordering rule, the tie handling and the flooring below must match
// lib/engine/settle.ts step by step, and potBreakdown.test.ts checks that they do
// against real settled weeks. If settlement's award rule ever changes, this changes
// with it — a divergence here is a lie told confidently, which is worse than silence.

export interface PotEntry {
  playerId: string;
  /** Net chip change for the week, ante included, before the Pot (§14). */
  gain: number;
  /** Folders are not eligible (§7). A ticket whose games all returned still is. */
  eligible: boolean;
}

export interface PotStanding extends PotEntry {
  /** 1-based finishing place among DISTINCT gain levels; null once out of the money. */
  place: number | null;
  /** Chips actually received. Zero unless placed. */
  award: number;
  /** How many players share this gain level — >1 means the place was split. */
  sharedBy: number;
}

export interface PotBreakdown {
  standings: PotStanding[];
  /** Chips in the Pot entering the award. */
  pool: number;
  /** The §7 split that was snapshotted at slate open, as percentages. */
  split: readonly number[];
  awarded: number;
  /** Whatever flooring left behind — it rolls into next week's Pot (§7). */
  rolled: number;
  /** True when the Pot was empty or under water: nobody wins, the marker carries. */
  noAward: boolean;
}

/** Mirrors settleWeek's award block. `pool` is the Pot balance entering the award. */
export function potBreakdown(input: {
  entries: PotEntry[];
  pool: number;
  /** Pass the split snapshotted at slate open; falls back to the §7 tier by head count. */
  split?: readonly number[];
  activeCount?: number;
}): PotBreakdown {
  const { entries, pool } = input;
  const split = input.split ?? potSplitForCount(input.activeCount ?? entries.length);

  const byGain = new Map<number, string[]>();
  for (const e of entries) {
    if (!e.eligible) continue;
    byGain.set(e.gain, [...(byGain.get(e.gain) ?? []), e.playerId]);
  }
  // Distinct gain levels take places in order; a tie occupies one place and splits it.
  const levels = [...byGain.keys()].sort((a, b) => b - a);

  const place = new Map<string, number>();
  const award = new Map<string, number>();
  const sharedBy = new Map<string, number>();
  let awarded = 0;

  const noAward = pool <= 0 || byGain.size === 0;
  levels.forEach((level, i) => {
    const group = byGain.get(level)!;
    for (const id of group) {
      place.set(id, i + 1);
      sharedBy.set(id, group.length);
    }
    if (noAward) return;
    const pct = split[i];
    if (pct === undefined) return; // more gain levels than places: nothing below the cut
    const share = Math.floor((pool * pct) / 100);
    const each = Math.floor(share / group.length);
    if (each <= 0) return;
    for (const id of group) {
      award.set(id, each);
      awarded += each;
    }
  });

  const standings: PotStanding[] = entries
    .map((e) => ({
      ...e,
      place: e.eligible ? (place.get(e.playerId) ?? null) : null,
      award: award.get(e.playerId) ?? 0,
      sharedBy: sharedBy.get(e.playerId) ?? 1,
    }))
    // Highest gain first; folders sink to the bottom in name-stable order.
    .sort((a, b) => (a.eligible === b.eligible ? b.gain - a.gain : a.eligible ? -1 : 1));

  return {
    standings,
    pool,
    split,
    awarded,
    rolled: noAward ? Math.max(0, pool) : pool - awarded,
    noAward,
  };
}

/** How many places this week's split actually paid — for "3 places paid" copy. */
export function placesPaid(b: PotBreakdown): number {
  return new Set(b.standings.filter((s) => s.award > 0).map((s) => s.place)).size;
}
