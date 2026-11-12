import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { templateDoc } from "./docs";
import { renderHtml, renderText } from "./render";

describe("pictures in a broadcast (D-133)", () => {
  const doc = templateDoc({
    eyebrow: "ANTE",
    headline: "Two new games",
    body: "First words.\n\n[![Gridiron Bingo](https://play.theantegame.com/art/email-bingo.jpg)](https://play.theantegame.com/bingo)\n\n![Plain picture](https://example.com/x.jpg)\n\nLast words.",
  });

  it("turns an image-only paragraph into a picture, linked when wrapped in a link", () => {
    const kinds = doc.blocks.map((b) => b.kind);
    expect(kinds.slice(0, 4)).toEqual(["lead", "image", "image", "para"]);
    const html = renderHtml(doc);
    expect(html).toContain('<a href="https://play.theantegame.com/bingo"');
    expect(html).toContain('src="https://play.theantegame.com/art/email-bingo.jpg"');
    expect(html).toContain('alt="Gridiron Bingo"');
  });

  it("gives plain-text readers the words and the link, never a blank", () => {
    const text = renderText(doc);
    expect(text).toContain("[Gridiron Bingo] https://play.theantegame.com/bingo");
    expect(text).toContain("[Plain picture]");
    expect(doc.preheader).toBe("First words.");
  });

  it("leaves ordinary text and non-https images alone", () => {
    const d = templateDoc({ eyebrow: "A", headline: "H", body: "![x](http://insecure.example/x.jpg)" });
    expect(d.blocks[0].kind).toBe("lead");
  });
});
