import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// D-082: light mode is one declaration block in app/globals.css, written twice —
// unconditionally for [data-theme="light"] and under the prefers-color-scheme media
// query for [data-theme="auto"]. CSS cannot share one block across two conditions
// without a client script, so the mirror is kept honest here instead: extract both
// bodies, normalise whitespace, and demand they are identical.

function blockAfter(css: string, selector: string): string {
  const at = css.indexOf(selector);
  if (at < 0) throw new Error(`selector not found: ${selector}`);
  let i = css.indexOf("{", at);
  let depth = 0;
  const start = i + 1;
  for (; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(start, i);
    }
  }
  throw new Error(`unbalanced block after ${selector}`);
}

const normalise = (body: string) =>
  body
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");

describe("screen mode: the light block and its Auto mirror", () => {
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

  it("declares the same thing under both conditions", () => {
    const light = normalise(blockAfter(css, ':root[data-theme="light"]'));
    const auto = normalise(blockAfter(css, ':root[data-theme="auto"]'));
    expect(auto).toBe(light);
    expect(light).toContain("color-scheme: light;");
    expect(light).toContain("--color-canvas:");
  });

  it("keeps the Auto mirror inside the light media query", () => {
    const media = css.indexOf("@media (prefers-color-scheme: light)");
    const auto = css.indexOf(':root[data-theme="auto"]');
    expect(media).toBeGreaterThan(-1);
    expect(auto).toBeGreaterThan(media);
  });

  it("names the page scheme for native controls in the dark base", () => {
    // Several bare :root blocks exist (tokens, fonts); the scheme is declared once.
    expect(css).toMatch(/:root \{\s*color-scheme: dark;/);
  });
});
