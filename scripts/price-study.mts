/**
 * THE CONTRARIAN EQUILIBRIUM STUDY
 *
 * The owner's question: once everyone learns that the popular side pays badly, the room
 * spreads out hunting the underdog — so does the 2.50× ever get hit again, or does the
 * board flatten to 1.00× and the season turn into everyone winning a chip a week?
 *
 * This answers it with the REAL pricing rule (lib/engine multiplierFor, heads not chips)
 * over many simulated slates, at several league sizes and against several room
 * compositions — including the pathological one where EVERY player is a contrarian.
 *
 *   npx tsx scripts/price-study.mts
 *
 * Pure computation — no database, no app. Deterministic seed.
 */
import { multiplierFor } from "@/lib/engine/core";

const GAMES = 15;
const SLATES = 4000;

let seed = 424242;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

/** Public "popularity" of the home side per game — what the room can all see. */
function slatePopularity(): number[] {
  // Real slates are not 50/50: a few near-locks, a few pick'ems, most in between.
  return Array.from({ length: GAMES }, () => 0.5 + (rand() - 0.5) * 0.9);
}

type Style = "chalk" | "contrarian" | "coin" | "sharp";

/**
 * One player picks a side per game they bet. Contrarians take the unpopular side, but
 * they only know PUBLIC popularity — not what the other contrarians are doing. That
 * blindness is the whole point: it is what stops them from perfectly coordinating, and
 * it is exactly the situation the real blackout creates (§6).
 */
function pick(style: Style, homePop: number, noise = 0): "home" | "away" {
  // Each player reads the slate slightly differently. With noise = 0 every contrarian
  // fingers the SAME underdog and the room goes unanimous — which prices at even money
  // (§5: with nobody on the other side there is no ratio). Real disagreement is what
  // creates the two-sided split a multiplier needs, so this is the parameter that
  // decides whether the board is hot or flat.
  const perceived = noise === 0 ? homePop : homePop + (rand() - 0.5) * 2 * noise;
  const homeIsPopular = perceived > 0.5;
  switch (style) {
    case "chalk":
      return homeIsPopular ? "home" : "away";
    case "contrarian":
      return homeIsPopular ? "away" : "home";
    case "coin":
      return rand() < 0.5 ? "home" : "away";
    case "sharp":
      // Fades only where the crowd is mildly wrong; takes the chalk on true mismatches.
      return Math.abs(homePop - 0.5) < 0.25 ? (homeIsPopular ? "away" : "home") : homeIsPopular ? "home" : "away";
  }
}

interface PlayerWeek {
  /** Share of player-weeks containing at least one bet at the 2.50x cap. */
  anyCap: number;
  anyBig: number;
  anyFloor: number;
}

interface Outcome {
  capShare: number; // % of bets priced at 2.50x
  floorShare: number; // % of bets priced at 0.25x
  bigShare: number; // % of bets priced >= 2.00x
  evenish: number; // % of bets between 0.80x and 1.25x — the "boring" band
  median: number;
  meanBettorsPerGame: number;
  perPlayerWeek: PlayerWeek;
}

function run(players: number, mix: Record<Style, number>, betsPerPlayer: number, noise = 0.12): Outcome {
  const roster: Style[] = [];
  for (const [style, n] of Object.entries(mix) as Array<[Style, number]>) {
    for (let i = 0; i < Math.round(players * n); i++) roster.push(style);
  }
  while (roster.length < players) roster.push("coin");

  const prices: number[] = [];
  let cap = 0;
  let floor = 0;
  let big = 0;
  let even = 0;
  let gamesWithBets = 0;
  let totalHeads = 0;
  let playerWeeks = 0;
  let weeksWithCap = 0;
  let weeksWithBig = 0;
  let weeksWithFloor = 0;

  for (let s = 0; s < SLATES; s++) {
    const pop = slatePopularity();
    const heads: Array<{ home: number; away: number }> = Array.from({ length: GAMES }, () => ({ home: 0, away: 0 }));

    const slips: Array<Array<{ g: number; side: "home" | "away" }>> = [];
    for (const style of roster) {
      // Each player bets a random subset of the slate — the §3 minimum is five games.
      const chosen = new Set<number>();
      while (chosen.size < betsPerPlayer) chosen.add(Math.floor(rand() * GAMES));
      const slip: Array<{ g: number; side: "home" | "away" }> = [];
      for (const g of chosen) {
        const side = pick(style, pop[g], noise);
        heads[g][side] += 1;
        slip.push({ g, side });
      }
      slips.push(slip);
    }

    // Now that every head count is final, price each player's actual slip (§5).
    for (const slip of slips) {
      playerWeeks++;
      let sawCap = false;
      let sawBig = false;
      let sawFloor = false;
      for (const { g, side } of slip) {
        const h = heads[g];
        const m = multiplierFor(h[side], side === "home" ? h.away : h.home);
        const v = m.num / m.den;
        if (v >= 2.5) sawCap = true;
        if (v >= 2.0) sawBig = true;
        if (v <= 0.25) sawFloor = true;
      }
      if (sawCap) weeksWithCap++;
      if (sawBig) weeksWithBig++;
      if (sawFloor) weeksWithFloor++;
    }

    for (let g = 0; g < GAMES; g++) {
      const h = heads[g];
      if (h.home + h.away === 0) continue;
      gamesWithBets++;
      totalHeads += h.home + h.away;
      for (const side of ["home", "away"] as const) {
        const withC = h[side];
        if (withC === 0) continue;
        const againstC = side === "home" ? h.away : h.home;
        const m = multiplierFor(withC, againstC);
        const v = m.num / m.den;
        for (let k = 0; k < withC; k++) {
          prices.push(v);
          if (v >= 2.5) cap++;
          if (v <= 0.25) floor++;
          if (v >= 2.0) big++;
          if (v >= 0.8 && v <= 1.25) even++;
        }
      }
    }
  }

  prices.sort((a, b) => a - b);
  const n = prices.length;
  return {
    capShare: (100 * cap) / n,
    floorShare: (100 * floor) / n,
    bigShare: (100 * big) / n,
    evenish: (100 * even) / n,
    median: prices[Math.floor(n / 2)],
    meanBettorsPerGame: totalHeads / gamesWithBets,
    perPlayerWeek: {
      anyCap: (100 * weeksWithCap) / playerWeeks,
      anyBig: (100 * weeksWithBig) / playerWeeks,
      anyFloor: (100 * weeksWithFloor) / playerWeeks,
    },
  };
}

const MIXES: Array<[string, Record<Style, number>]> = [
  ["mixed room (season one)", { chalk: 0.3, contrarian: 0.25, coin: 0.25, sharp: 0.2 }],
  ["everyone turns contrarian", { chalk: 0, contrarian: 1, coin: 0, sharp: 0 }],
  ["contrarian + a few holdouts", { chalk: 0.15, contrarian: 0.7, coin: 0.15, sharp: 0 }],
  ["everyone plays chalk", { chalk: 1, contrarian: 0, coin: 0, sharp: 0 }],
  ["nobody has a system", { chalk: 0, contrarian: 0, coin: 1, sharp: 0 }],
];

const pct = (x: number) => `${x.toFixed(1)}%`.padStart(6);

for (const size of [8, 12, 20, 25, 30]) {
  console.log(`\n─── ${size} players · ${GAMES} games · each bets 8 ${"─".repeat(34)}`);
  console.log("  room                          bettors/gm   2.50× cap   ≥2.00×   0.25× floor   ~even   median");
  for (const [label, mix] of MIXES) {
    const o = run(size, mix, 8);
    console.log(
      `  ${label.padEnd(28)}  ${o.meanBettorsPerGame.toFixed(1).padStart(9)}   ${pct(o.capShare)}   ${pct(
        o.bigShare,
      )}   ${pct(o.floorShare)}   ${pct(o.evenish)}   ${o.median.toFixed(2)}×`,
    );
  }
}

// THE QUESTION, isolated. Everyone hunts the underdog; the only thing that varies is how
// much they disagree about which team that is. Noise 0 = a hive mind; 0.30 = a real room.
console.log(`\n─── 20 players, ALL hunting the underdog, varying how much they disagree ${"─".repeat(4)}`);
console.log("  disagreement   2.50× cap   ≥2.00×   0.25× floor   ~even   median");
for (const nz of [0, 0.05, 0.1, 0.2, 0.3, 0.5]) {
  const o = run(20, { chalk: 0, contrarian: 1, coin: 0, sharp: 0 }, 8, nz);
  console.log(
    `  ${nz.toFixed(2).padStart(12)}   ${pct(o.capShare)}   ${pct(o.bigShare)}   ${pct(o.floorShare)}   ${pct(
      o.evenish,
    )}   ${o.median.toFixed(2)}×`,
  );
}

// Does spreading across MORE games flatten the board? Fewer heads per game should make
// ratios more extreme, not less.
console.log(`\n─── 20 players, realistic disagreement, varying how many games each bets ${"─".repeat(3)}`);
console.log("  bets/player   bettors/gm   2.50× cap   ≥2.00×   ~even   median");
for (const b of [5, 8, 11, 15]) {
  const o = run(20, { chalk: 0.2, contrarian: 0.5, coin: 0.1, sharp: 0.2 }, b, 0.2);
  console.log(
    `  ${String(b).padStart(11)}   ${o.meanBettorsPerGame.toFixed(1).padStart(10)}   ${pct(o.capShare)}   ${pct(
      o.bigShare,
    )}   ${pct(o.evenish)}   ${o.median.toFixed(2)}×`,
  );
}


// The number that decides whether a week feels alive: not what share of BETS hit the cap,
// but what share of PLAYERS walk away from a week having hit one at least once.
console.log(`\n─── Share of players who hit at least one big price in a given week ${"─".repeat(6)}`);
console.log("  league   room                          ≥1 at 2.50×   ≥1 at ≥2.00×   ≥1 at 0.25×   ~players/wk at cap");
for (const size of [12, 20, 25]) {
  for (const [label, mix] of MIXES.filter(([l]) => l !== "everyone plays chalk")) {
    const o = run(size, mix, 8, 0.2);
    const heads = ((o.perPlayerWeek.anyCap / 100) * size).toFixed(1);
    console.log(
      `  ${String(size).padStart(6)}   ${label.padEnd(28)}  ${pct(o.perPlayerWeek.anyCap)}        ${pct(
        o.perPlayerWeek.anyBig,
      )}        ${pct(o.perPlayerWeek.anyFloor)}        ${heads.padStart(8)}`,
    );
  }
}
