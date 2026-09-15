import { describe, expect, it } from "vitest";
import { blocksOf, isPlain } from "./format";

describe("blocksOf", () => {
  it("keeps a one-line message as one plain paragraph", () => {
    const b = blocksOf("Bills by ten, book it");
    expect(b).toEqual([{ kind: "p", text: "Bills by ten, book it" }]);
    expect(isPlain(b)).toBe(true);
  });

  it("reads dash, star and dot bullets into one list", () => {
    expect(blocksOf("Locks this week:\n- Bills\n* Chiefs\n• Lions")).toEqual([
      { kind: "p", text: "Locks this week:" },
      { kind: "ul", items: ["Bills", "Chiefs", "Lions"] },
    ]);
  });

  it("reads numbered items", () => {
    expect(blocksOf("1. ante\n2) pick\n3. pray")).toEqual([{ kind: "ol", items: ["ante", "pick", "pray"] }]);
  });

  it("splits a list from a following paragraph and a blank line between paragraphs", () => {
    expect(blocksOf("- a\n- b\nthat's it\n\nsee you Thursday")).toEqual([
      { kind: "ul", items: ["a", "b"] },
      { kind: "p", text: "that's it" },
      { kind: "p", text: "see you Thursday" },
    ]);
  });

  it("keeps a single line break inside a paragraph, and is not plain then", () => {
    const b = blocksOf("line one\nline two");
    expect(b).toEqual([{ kind: "p", text: "line one\nline two" }]);
    expect(isPlain(b)).toBe(false);
  });

  it("does not mistake a bare dash, a minus sign or a score for a list", () => {
    // A lone dash is a message, not an empty bullet.
    expect(blocksOf("-")).toEqual([{ kind: "p", text: "-" }]);
    expect(blocksOf("- ")).toEqual([{ kind: "p", text: "-" }]);
    expect(blocksOf("Bills -3 at home")).toEqual([{ kind: "p", text: "Bills -3 at home" }]);
    expect(blocksOf("24-17 final")).toEqual([{ kind: "p", text: "24-17 final" }]);
  });

  it("normalises Windows line endings", () => {
    expect(blocksOf("- a\r\n- b")).toEqual([{ kind: "ul", items: ["a", "b"] }]);
  });
});
