import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { templateDoc } from "./docs";
import { renderHtml, renderText } from "./render";
import { fillStory } from "./story";

describe("From the table (D-134)", () => {
  const doc = templateDoc({ eyebrow: "ANTE", headline: "H", body: "Hello." });

  it("no longer carries 'Why I built this'", () => {
    expect(renderHtml(doc)).not.toContain("Why I built this");
    expect(renderText(doc)).not.toContain("WHY I BUILT THIS");
  });

  it("fills the slot with this week's story", () => {
    const filled = fillStory(doc, { title: "From the table · Week 9", paras: ["Sam backed the Jets.", "It paid 2.5×."] });
    const html = renderHtml(filled);
    expect(html).toContain("From the table · Week 9");
    expect(html).toContain("Sam backed the Jets.");
    expect(renderText(filled)).toContain("FROM THE TABLE · WEEK 9");
  });

  it("drops the slot cleanly when there's no story", () => {
    const empty = fillStory(doc, null);
    expect(empty.blocks.some((b) => b.kind === "story")).toBe(false);
  });
});
