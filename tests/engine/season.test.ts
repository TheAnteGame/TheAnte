import { describe, expect, it } from "vitest";
import {
  anteForWeek,
  assertInvariants,
  computeBalances,
  computeSlateOpen,
  potSplitForCount,
  revealEntries,
  settleWeek,
  STARTING_STACK,
} from "@/lib/engine";
import type { EngineGame, EngineLedgerEntry, EnginePlayer, EngineTicket } from "@/lib/engine";

// §8.1 of ANTE-TECH: "run a simulated season... a conservation bug that only appears
// in Week 14 will not be found by unit tests alone." Deterministic seeded PRNG — the
// engine itself has no clock and no randomness; the chaos is all in the test.

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function runSeason(seed: number) {
  const rand = lcg(seed);
  const N = 12;
  const ids = Array.from({ length: N }, (_, i) => `p${i}`);
  const ledger: EngineLedgerEntry[] = [];
  const shoveUsed = new Map<string, number | null>(ids.map((id) => [id, null]));

  for (const id of ids) {
    ledger.push({ account: id, kind: "buy_in", amount: STARTING_STACK, reason: "buy-in" });
  }

  for (let week = 1; week <= 18; week++) {
    const ante = anteForWeek(week);
    const balances = computeBalances(ledger);
    const players: EnginePlayer[] = ids.map((id) => ({
      id,
      status: "approved",
      stackPreAnte: balances.stacks.get(id)!,
      shoveUsedWeek: shoveUsed.get(id)!,
    }));

    // Step 1–2: slate opens, median snapshots, antes come out.
    const slate = computeSlateOpen(players, week);
    ledger.push(...slate.entries);

    // The slate: 15 games, straight-up outcomes, occasional tie / cancellation.
    const games: EngineGame[] = Array.from({ length: 15 }, (_, i) => {
      const r = rand();
      const outcome: EngineGame["outcome"] =
        r < 0.015
          ? { kind: "void", reason: "cancelled" }
          : r < 0.035
            ? { kind: "final", winner: "tie" }
            : { kind: "final", winner: r < 0.5 ? "away" : "home" };
      return { id: `w${week}g${i}`, outcome };
    });

    // Step 3: tickets, blind. Folds, shoves, felt bets, short stacks — all of it.
    const tickets: EngineTicket[] = [];
    for (const p of players) {
      if (rand() < 0.06) {
        tickets.push({ playerId: p.id, isFold: true, isShove: false, bets: [], committedStake: null, pendingRefund: null });
        continue;
      }
      const felt = slate.feltPlayerIds.has(p.id);
      const limit = slate.houseLimits.get(p.id)!;

      if (!felt && p.shoveUsedWeek === null && rand() < 0.04) {
        const committed = p.stackPreAnte; // stackAtSubmit + ante = the pre-ante stack (§8.7)
        tickets.push({
          playerId: p.id,
          isFold: false,
          isShove: true,
          bets: [{ gameId: games[Math.floor(rand() * 15)].id, side: rand() < 0.5 ? "away" : "home", chips: committed }],
          committedStake: committed,
          pendingRefund: ante,
        });
        shoveUsed.set(p.id, week);
        continue;
      }

      if (felt) {
        if (limit < 1) {
          tickets.push({ playerId: p.id, isFold: true, isShove: false, bets: [], committedStake: null, pendingRefund: null });
          continue;
        }
        // §9: bet what you have, on whatever you want — step of 1, no minimums.
        const chips = Math.max(1, Math.floor(rand() * limit));
        tickets.push({
          playerId: p.id,
          isFold: false,
          isShove: false,
          bets: [{ gameId: games[Math.floor(rand() * 15)].id, side: rand() < 0.5 ? "away" : "home", chips }],
          committedStake: null,
          pendingRefund: null,
        });
        continue;
      }

      // Normal ticket: 5+ games at 10–50 in steps of 10, never over the limit;
      // short stack rule: if the limit won't cover five, play what it covers (§4).
      const maxGames = Math.min(5 + Math.floor(rand() * 4), Math.floor(limit / 10));
      const bets: EngineTicket["bets"] = [];
      let committed = 0;
      const shuffled = [...games].sort(() => rand() - 0.5);
      for (const g of shuffled.slice(0, Math.max(maxGames, 0))) {
        const room = limit - committed;
        if (room < 10) break;
        const chips = Math.min(10 * (1 + Math.floor(rand() * 5)), 50, 10 * Math.floor(room / 10));
        bets.push({ gameId: g.id, side: rand() < 0.5 ? "away" : "home", chips });
        committed += chips;
      }
      if (bets.length === 0) {
        tickets.push({ playerId: p.id, isFold: true, isShove: false, bets: [], committedStake: null, pendingRefund: null });
      } else {
        tickets.push({ playerId: p.id, isFold: false, isShove: false, bets, committedStake: null, pendingRefund: null });
      }
    }

    // Step 4: the reveal posts every deferred entry atomically.
    ledger.push(...revealEntries(tickets, week));

    // Steps 6–8: settle, sweep, floor, award.
    const atReveal = computeBalances(ledger);
    const result = settleWeek({
      weekNumber: week,
      tickets,
      games,
      players: ids.map((id) => ({
        id,
        stackPreAnte: balances.stacks.get(id)!,
        stackAtReveal: atReveal.stacks.get(id)!,
      })),
      potBalance: atReveal.pot,
      potSplit: potSplitForCount(slate.activeCountSnapshot),
    });
    ledger.push(...result.entries);
    for (const id of result.returnedShoves) shoveUsed.set(id, null); // the card comes back (§14)

    // THE assertion — after every simulated week, not just at the end (§8.1).
    assertInvariants(ledger);
  }

  return { ledger, balances: computeBalances(ledger) };
}

describe("a full simulated season (ANTE-TECH §8.1)", () => {
  it("conserves every chip across 18 weeks, for multiple seeds", () => {
    for (const seed of [1, 7, 42, 1337, 2026]) {
      const { balances } = runSeason(seed);
      const totalStacks = [...balances.stacks.values()].reduce((a, b) => a + b, 0);
      expect(totalStacks + balances.pot).toBe(12 * STARTING_STACK);
      for (const stack of balances.stacks.values()) expect(stack).toBeGreaterThanOrEqual(1);
    }
  });

  it("no ledger entry is ever fractional", () => {
    const { ledger } = runSeason(99);
    expect(ledger.every((e) => Number.isInteger(e.amount))).toBe(true);
  });

  it("every entry carries a reason (§8.12)", () => {
    const { ledger } = runSeason(3);
    expect(ledger.every((e) => e.reason.trim().length > 0)).toBe(true);
  });
});
