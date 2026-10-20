// Play style (D-113): what kind of player you are, and what the players at the top are
// doing — so people can see a strategy instead of guessing at one. Pure, no I/O.
//
// Every trait is RELATIVE to the league, never a fixed threshold. A fixed rule like
// "contrarians win" would be an opinion; in this league's first six weeks the crowd
// side was winning (the leader took it 61% of the time at a 68% hit rate), and next
// season it may not be. The type says where you stand among these players, and the
// top-player comparison is computed from whoever is actually on top.
//
// BLACKOUT: callers pass SETTLED weeks only, so this sits still from the ante to the
// payout (§6). Nothing here names anyone: the top group is reported as averages.

export interface PlayerProfile {
  playerId: string;
  /** Weeks with a live (non-fold) ticket. */
  liveWeeks: number;
  bets: number;
  chipsBet: number;
  /** Bets that won or lost (ties and voids excluded). */
  decided: number;
  won: number;
  /** Decided bets on the side more players took (price under 1×). */
  crowd: number;
  /** Decided bets on the side fewer players took (price over 1×). */
  lonely: number;
  /** Chips staked on decided bets, and what they netted: payouts won minus chips lost. */
  chipsDecided: number;
  net: number;
  /** Weeks the player's favorite team was on the slate while they played, and how
   *  often they backed it. */
  homeChances: number;
  homeBacked: number;
  /** Total result over settled weeks, Pots included — the ranking for "top players". */
  result: number;
}

export type PlayStyle = "chalk" | "wolf" | "sniper" | "spreader" | "homer" | "balanced";

export interface StyleNumbers {
  winPct: number;
  crowdPct: number;
  lonelyPct: number;
  gamesPerWeek: number;
  chipsPerBet: number;
  /** Chips netted per 100 chips bet on decided games — "for every 100 you bet". */
  netPer100: number;
}

export interface PlayStyleReport {
  style: PlayStyle;
  me: StyleNumbers;
  top: StyleNumbers;
  /** True when the viewer is one of the top players. */
  meIsTop: boolean;
  /** How many players the top group is. */
  topSize: number;
  /** The one comparison worth acting on, or null when nothing stands out. */
  hint: { metric: keyof StyleNumbers; me: number; top: number } | null;
}

export const MIN_DECIDED = 10;
export const MIN_WEEKS = 2;
export const TOP_SIZE = 4;
const HOMER_MIN_CHANCES = 5;
const HOMER_MIN_RATE = 0.8;

const eligible = (p: PlayerProfile) => p.decided >= MIN_DECIDED && p.liveWeeks >= MIN_WEEKS;

export function numbersOf(p: PlayerProfile): StyleNumbers {
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  return {
    winPct: pct(p.won, p.decided),
    crowdPct: pct(p.crowd, p.decided),
    lonelyPct: pct(p.lonely, p.decided),
    gamesPerWeek: p.liveWeeks > 0 ? Math.round((p.bets / p.liveWeeks) * 10) / 10 : 0,
    chipsPerBet: p.bets > 0 ? Math.round(p.chipsBet / p.bets) : 0,
    netPer100: p.chipsDecided > 0 ? Math.round((p.net / p.chipsDecided) * 100) : 0,
  };
}

/** Share of the OTHER players strictly below this value: 0 = lowest, 1 = highest. */
function standing(value: number, others: number[]): number {
  if (others.length === 0) return 0;
  return others.filter((v) => v < value).length / others.length;
}

/** The trait this player shows most strongly compared with everyone else. */
export function styleOf(p: PlayerProfile, field: PlayerProfile[]): PlayStyle {
  const me = numbersOf(p);
  const others = field.filter((x) => x.playerId !== p.playerId).map(numbersOf);

  const games = standing(me.gamesPerWeek, others.map((o) => o.gamesPerWeek));
  const chips = standing(me.chipsPerBet, others.map((o) => o.chipsPerBet));
  const scores: Array<[PlayStyle, number]> = [
    // Judged on the habit itself, and ruled out by its opposite: a spreader plays many
    // games and does not also bet big (that is just a big bettor); a sniper bets big
    // and does not also play everything.
    ["spreader", chips > 0.5 ? 0 : games],
    ["sniper", games > 0.5 ? 0 : chips],
    ["wolf", standing(me.lonelyPct, others.map((o) => o.lonelyPct))],
    ["chalk", standing(me.crowdPct, others.map((o) => o.crowdPct))],
  ];
  // Homer is not relative: backing your own team in 80% of at least five chances is a habit
  // whatever the rest of the league does. It wins only when it is that strong.
  const homerRate = p.homeChances > 0 ? p.homeBacked / p.homeChances : 0;
  if (p.homeChances >= HOMER_MIN_CHANCES && homerRate >= HOMER_MIN_RATE) scores.push(["homer", homerRate]);

  // Highest standing wins; ties go in the order listed (stable sort). A player who is
  // not past the league middle on ANY habit is not a lone wolf by default — they are
  // balanced, and saying otherwise would tell them something untrue about how they play.
  const [best, score] = [...scores].sort((a, b) => b[1] - a[1])[0];
  return score > 0.5 ? best : "balanced";
}

function average(rows: StyleNumbers[]): StyleNumbers {
  const avg = (k: keyof StyleNumbers, places: number) => {
    const m = rows.reduce((s, r) => s + r[k], 0) / rows.length;
    const f = 10 ** places;
    return Math.round(m * f) / f;
  };
  return {
    winPct: avg("winPct", 0),
    crowdPct: avg("crowdPct", 0),
    lonelyPct: avg("lonelyPct", 0),
    gamesPerWeek: avg("gamesPerWeek", 1),
    chipsPerBet: avg("chipsPerBet", 0),
    netPer100: avg("netPer100", 0),
  };
}

/** The viewer's card, or null when they (or the league) have too little history. */
export function playStyleReport(viewerId: string, profiles: PlayerProfile[]): PlayStyleReport | null {
  const field = profiles.filter(eligible);
  const me = field.find((p) => p.playerId === viewerId);
  if (!me || field.length < TOP_SIZE + 1) return null;

  const ranked = [...field].sort((a, b) => b.result - a.result || a.playerId.localeCompare(b.playerId));
  const topGroup = ranked.slice(0, TOP_SIZE);
  const meIsTop = topGroup.some((p) => p.playerId === viewerId);
  const top = average(topGroup.map(numbersOf));
  const mine = numbersOf(me);

  // The hint: the habit where the viewer differs most from the top group, measured
  // against how much that habit varies across the league — so 3 games a week apart
  // and 15 points of crowd-share apart are compared fairly. Results (win %, net) are
  // left out: they are outcomes, not something you can choose to do differently.
  let hint: PlayStyleReport["hint"] = null;
  if (!meIsTop) {
    const all = field.map(numbersOf);
    const spread = (k: keyof StyleNumbers) => {
      const vals = all.map((r) => r[k]);
      return Math.max(...vals) - Math.min(...vals) || 1;
    };
    const habits: Array<keyof StyleNumbers> = ["crowdPct", "gamesPerWeek", "chipsPerBet"];
    const gaps = habits.map((k) => ({ k, size: Math.abs(mine[k] - top[k]) / spread(k) }));
    const biggest = gaps.sort((a, b) => b.size - a.size)[0];
    if (biggest && biggest.size >= 0.2) hint = { metric: biggest.k, me: mine[biggest.k], top: top[biggest.k] };
  }

  return { style: styleOf(me, field), me: mine, top, meIsTop, topSize: TOP_SIZE, hint };
}
