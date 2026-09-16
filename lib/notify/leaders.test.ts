import { describe, expect, it } from "vitest";
import { emailStandings } from "./leaders";

const row = (id: string, stack: number, delta = 0) => ({ id, name: id.toUpperCase(), stack, delta });

describe("emailStandings", () => {
  it("lists every player, not the first eight", () => {
    const rows = Array.from({ length: 13 }, (_, i) => row(`p${i}`, 500 - i));
    const { leaders } = emailStandings(rows);
    expect(leaders).toHaveLength(13);
    expect(leaders.at(-1)?.rank).toBe("13");
  });

  it("finds a rank for a player well below the top eight, by id not name", () => {
    const rows = Array.from({ length: 13 }, (_, i) => row(`p${i}`, 500 - i));
    const { rankOf } = emailStandings(rows);
    expect(rankOf.get("p11")).toBe("12");
    expect(rankOf.get("nobody")).toBeUndefined();
  });

  it("shares a place on equal stacks and skips the next, like the standings view", () => {
    const { leaders, rankOf } = emailStandings([row("a", 500), row("b", 500), row("c", 490), row("d", 500)]);
    expect(leaders.map((l) => l.rank)).toEqual(["1", "1", "1", "4"]);
    expect(rankOf.get("c")).toBe("4");
  });

  it("signs the weekly delta", () => {
    const { leaders } = emailStandings([row("a", 520, 20), row("b", 480, -20), row("c", 500, 0)]);
    expect(leaders.map((l) => l.delta)).toEqual(["+20", "+0", "-20"]);
  });
});
