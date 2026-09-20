import { describe, expect, it } from "vitest";
import { rotateBySource, type NewsItem } from "./select";

const row = (id: string, sourceId: string): NewsItem => ({ id, title: id, url: null, sourceId, source: sourceId });

describe("rotateBySource", () => {
  it("gives every source a turn before any source gets a second", () => {
    const rows = [row("a1", "A"), row("a2", "A"), row("a3", "A"), row("b1", "B"), row("b2", "B"), row("c1", "C")];
    expect(rotateBySource(rows, 6).map((r) => r.id)).toEqual(["a1", "b1", "c1", "a2", "b2", "a3"]);
  });

  it("stops one prolific feed owning the box", () => {
    const rows = [...Array.from({ length: 20 }, (_, i) => row(`a${i}`, "A")), row("b1", "B")];
    const out = rotateBySource(rows, 4).map((r) => r.sourceId);
    expect(out.filter((s) => s === "B")).toHaveLength(1);
    expect(out[1]).toBe("B");
  });

  it("is a no-op ordering when there is only one source — today's every team", () => {
    const rows = [row("a1", "A"), row("a2", "A"), row("a3", "A")];
    expect(rotateBySource(rows, 8).map((r) => r.id)).toEqual(["a1", "a2", "a3"]);
  });

  it("is stable across calls, so a five-second poll cannot reshuffle the fader", () => {
    const rows = [row("a1", "A"), row("b1", "B"), row("a2", "A")];
    expect(rotateBySource(rows, 3)).toEqual(rotateBySource(rows, 3));
  });

  it("honours the limit and tolerates an unsourced item", () => {
    const rows = [row("a1", "A"), { ...row("x", "A"), sourceId: null }];
    expect(rotateBySource(rows, 1)).toHaveLength(1);
    expect(rotateBySource(rows, 9)).toHaveLength(2);
  });
});
