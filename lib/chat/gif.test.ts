import { describe, expect, it } from "vitest";
import { extractGif, gifUrlOf } from "./gif";

describe("gifUrlOf", () => {
  it("accepts a Tenor media link on its own line", () => {
    expect(gifUrlOf("https://media.tenor.com/abc/tenor.gif")).toBe("https://media.tenor.com/abc/tenor.gif");
    expect(gifUrlOf("  https://c.tenor.com/x/AAAAC/name.gif  ")).toBe("https://c.tenor.com/x/AAAAC/name.gif");
  });
  it("accepts a GIPHY media link, query string and all", () => {
    expect(gifUrlOf("https://media2.giphy.com/media/abc/200.gif?cid=xyz&rid=200.gif")).toContain("media2.giphy.com");
  });
  it("refuses other hosts, http, and links with words around them", () => {
    expect(gifUrlOf("https://example.com/cat.gif")).toBeNull();
    expect(gifUrlOf("http://media.tenor.com/abc/tenor.gif")).toBeNull();
    expect(gifUrlOf("look https://media.tenor.com/abc/tenor.gif")).toBeNull();
  });
});

describe("extractGif", () => {
  it("lifts the first GIF out and keeps the words", () => {
    const r = extractGif("Rams suck\nhttps://media.tenor.com/a/b.gif");
    expect(r).toEqual({ text: "Rams suck", gif: "https://media.tenor.com/a/b.gif" });
  });
  it("renders only one image per message; a second link stays text", () => {
    const r = extractGif("https://media.tenor.com/a/b.gif\nhttps://media.tenor.com/c/d.gif");
    expect(r.gif).toBe("https://media.tenor.com/a/b.gif");
    expect(r.text).toBe("https://media.tenor.com/c/d.gif");
  });
  it("leaves a plain message alone", () => {
    expect(extractGif("no gif here")).toEqual({ text: "no gif here", gif: null });
  });
});
