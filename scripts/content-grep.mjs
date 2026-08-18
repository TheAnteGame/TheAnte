// Acceptance test 8 (ANTE-ADMIN §7): every string rendered in the PLAYER app
// resolves from content blocks — grep the components for JSX text literals as a CI
// check. The rules renderer is whitelisted by design; a small allowlist tracks
// symbols and known literals so NEW hardcoded copy fails the build.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SCAN = ["app", "components"];
const SKIP = [/^app\/admin\//, /^components\/admin\//, /^app\/api\//, /^app\/rules\//];

const ALLOWLIST_PATH = join(ROOT, "tests/content-allowlist.txt");
const allow = new Set(
  readFileSync(ALLOWLIST_PATH, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#")),
);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith(".tsx")) yield p;
  }
}

const findings = [];
for (const base of SCAN) {
  for (const file of walk(join(ROOT, base))) {
    const rel = relative(ROOT, file);
    if (SKIP.some((r) => r.test(rel))) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      // JSX text nodes with at least two letters — `>{expr}<` never matches.
      for (const m of line.matchAll(/>([^<>{}]*[A-Za-z]{2}[^<>{}]*)</g)) {
        const text = m[1].trim();
        if (!text || allow.has(text)) continue;
        findings.push(`${rel}:${i + 1}  "${text}"`);
      }
    });
  }
}

if (findings.length > 0) {
  console.error("Hardcoded player-app strings (add a content key, or allowlist deliberately):");
  for (const f of findings) console.error("  " + f);
  process.exit(1);
}
console.log("content-grep: player app clean (acceptance test 8)");
