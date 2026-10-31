import { describe, expect, it } from "vitest";
import { applyPick, reactionLine, summarize } from "./reactions";

const names: Record<string, string> = { me: "Zack T.", a: "Dustin G.", b: "Casey B.", c: "Deb T." };
const nameOf = (id: string) => names[id] ?? "—";

describe("reactions (D-123)", () => {
  const rows = [
    { player_id: "a", kind: "laugh" },
    { player_id: "b", kind: "laugh" },
    { player_id: "me", kind: "fire" },
    { player_id: "c", kind: "like" },
  ];

  it("summarises in a fixed order with counts, names and mine", () => {
    const s = summarize(rows, "me", nameOf);
    expect(s.chips.map((c) => `${c.emoji}${c.count}`)).toEqual(["👍1", "😂2", "🔥1"]);
    expect(s.chips.find((c) => c.kind === "laugh")?.names).toEqual(["Dustin G.", "Casey B."]);
    expect(s.mine).toBe("fire");
  });

  it("swaps my reaction, dropping a chip that empties", () => {
    const next = applyPick(summarize(rows, "me", nameOf), "laugh", "Zack T.");
    expect(next.mine).toBe("laugh");
    expect(next.chips.map((c) => `${c.emoji}${c.count}`)).toEqual(["👍1", "😂3"]);
  });

  it("takes mine off and adds a new kind in its place in the order", () => {
    const off = applyPick(summarize(rows, "me", nameOf), null, "Zack T.");
    expect(off.mine).toBeNull();
    expect(off.chips.map((c) => c.kind)).toEqual(["like", "laugh"]);
    const love = applyPick(off, "love", "Zack T.");
    expect(love.chips.map((c) => c.kind)).toEqual(["like", "love", "laugh"]);
  });

  it("never edits the summary it was given", () => {
    const before = summarize(rows, "me", nameOf);
    const copy = JSON.stringify(before);
    applyPick(before, "laugh", "Zack T.");
    expect(JSON.stringify(before)).toBe(copy);
  });

  it("writes the author's line", () => {
    expect(reactionLine(rows)).toBe("👍 1 · 😂 2 · 🔥 1");
  });
});
