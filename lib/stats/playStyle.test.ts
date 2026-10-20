import { describe, expect, it } from "vitest";
import { playStyleReport, styleOf, type PlayerProfile } from "./playStyle";

// The league after six settled weeks (2026-10-20), anonymised: p01 is first by
// result, p14 last. Rebuilt from per-player rates, so counts are approximate — the
// point is that the classifier splits a real league sensibly.
const LEAGUE: PlayerProfile[] = [{"playerId":"p01","liveWeeks":6,"bets":32,"chipsBet":576,"decided":31,"won":21,"crowd":19,"lonely":4,"chipsDecided":558,"net":117,"homeChances":6,"homeBacked":3,"result":999},{"playerId":"p02","liveWeeks":5,"bets":54,"chipsBet":756,"decided":54,"won":29,"crowd":28,"lonely":12,"chipsDecided":756,"net":44,"homeChances":5,"homeBacked":4,"result":998},{"playerId":"p03","liveWeeks":5,"bets":44,"chipsBet":572,"decided":44,"won":28,"crowd":22,"lonely":9,"chipsDecided":572,"net":135,"homeChances":5,"homeBacked":3,"result":997},{"playerId":"p04","liveWeeks":6,"bets":32,"chipsBet":640,"decided":31,"won":20,"crowd":17,"lonely":6,"chipsDecided":620,"net":134,"homeChances":6,"homeBacked":2,"result":996},{"playerId":"p05","liveWeeks":6,"bets":31,"chipsBet":744,"decided":31,"won":16,"crowd":16,"lonely":7,"chipsDecided":744,"net":34,"homeChances":6,"homeBacked":2,"result":995},{"playerId":"p06","liveWeeks":6,"bets":52,"chipsBet":936,"decided":52,"won":30,"crowd":26,"lonely":8,"chipsDecided":936,"net":63,"homeChances":6,"homeBacked":2,"result":994},{"playerId":"p07","liveWeeks":6,"bets":37,"chipsBet":925,"decided":37,"won":24,"crowd":21,"lonely":6,"chipsDecided":925,"net":163,"homeChances":6,"homeBacked":2,"result":993},{"playerId":"p08","liveWeeks":5,"bets":42,"chipsBet":546,"decided":42,"won":25,"crowd":24,"lonely":8,"chipsDecided":546,"net":67,"homeChances":5,"homeBacked":4,"result":992},{"playerId":"p09","liveWeeks":6,"bets":50,"chipsBet":550,"decided":49,"won":29,"crowd":27,"lonely":7,"chipsDecided":539,"net":30,"homeChances":6,"homeBacked":5,"result":991},{"playerId":"p10","liveWeeks":6,"bets":39,"chipsBet":546,"decided":39,"won":21,"crowd":17,"lonely":11,"chipsDecided":546,"net":38,"homeChances":6,"homeBacked":3,"result":990},{"playerId":"p11","liveWeeks":6,"bets":45,"chipsBet":720,"decided":45,"won":26,"crowd":27,"lonely":8,"chipsDecided":720,"net":15,"homeChances":6,"homeBacked":5,"result":989},{"playerId":"p12","liveWeeks":6,"bets":31,"chipsBet":651,"decided":31,"won":16,"crowd":17,"lonely":8,"chipsDecided":651,"net":-4,"homeChances":6,"homeBacked":1,"result":988},{"playerId":"p13","liveWeeks":6,"bets":42,"chipsBet":672,"decided":41,"won":21,"crowd":25,"lonely":7,"chipsDecided":656,"net":-57,"homeChances":5,"homeBacked":2,"result":987},{"playerId":"p14","liveWeeks":5,"bets":31,"chipsBet":651,"decided":31,"won":14,"crowd":13,"lonely":13,"chipsDecided":651,"net":-15,"homeChances":4,"homeBacked":3,"result":986}];

const styleFor = (id: string) => playStyleReport(id, LEAGUE)!.style;

describe("play style (D-113)", () => {
  it("splits the real league across every type", () => {
    expect(LEAGUE.map((p) => [p.playerId, styleFor(p.playerId)])).toEqual([
      ["p01", "chalk"], ["p02", "spreader"], ["p03", "spreader"], ["p04", "sniper"], ["p05", "sniper"],
      ["p06", "balanced"], ["p07", "sniper"], ["p08", "homer"], ["p09", "homer"], ["p10", "wolf"],
      ["p11", "chalk"], ["p12", "wolf"], ["p13", "chalk"], ["p14", "wolf"],
    ]);
  });

  it("a player past the middle on no habit is balanced, not a lone wolf by default", () => {
    expect(styleFor("p06")).toBe("balanced");
  });

  it("homer needs at least five chances at 80% — four of five is not a habit yet", () => {
    const p = { ...LEAGUE[9], homeChances: 4, homeBacked: 4 };
    expect(styleOf(p, LEAGUE.map((x) => (x.playerId === p.playerId ? p : x)))).not.toBe("homer");
  });

  it("the top group is the top four by result, reported as averages only", () => {
    const r = playStyleReport("p14", LEAGUE)!;
    expect(r.meIsTop).toBe(false);
    expect(r.topSize).toBe(4);
    expect(r.top).toEqual({ winPct: 63, crowdPct: 55, lonelyPct: 19, gamesPerWeek: 7.6, chipsPerBet: 16, netPer10: 1.8 });
  });

  it("a top player gets no 'do it like them' hint", () => {
    const r = playStyleReport("p01", LEAGUE)!;
    expect(r.meIsTop).toBe(true);
    expect(r.hint).toBeNull();
  });

  it("the hint is a habit, never an outcome, and points at the biggest real gap", () => {
    expect(playStyleReport("p14", LEAGUE)!.hint).toEqual({ metric: "crowdPct", me: 42, top: 55 });
    expect(playStyleReport("p05", LEAGUE)!.hint).toEqual({ metric: "chipsPerBet", me: 24, top: 16 });
  });

  it("too little history — the viewer's or the league's — shows no card", () => {
    const thin = { ...LEAGUE[13], decided: 6 };
    expect(playStyleReport("p14", [...LEAGUE.slice(0, 13), thin])).toBeNull();
    expect(playStyleReport("p01", LEAGUE.slice(0, 4))).toBeNull();
  });
});
