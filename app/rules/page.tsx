import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { marked } from "marked";

// /rules — the versioned rulebook, rendered from the repo file (ANTE-ADMIN §4.4's one
// exemption from the content system: the rulebook is the authority and ships with the
// code, so it cannot drift from what the engine implements). Public on purpose — the
// felt card in the tutorial says "open to everyone", and proxy.ts has whitelisted this
// route since day one. It just never existed until the tutorial linked to it (D-036).
//
// The markdown is trusted repo content compiled by us — no sanitization layer needed.
// next.config.ts carries an outputFileTracingIncludes entry so the file ships in the
// serverless bundle on Vercel.

export const dynamic = "force-static";

export default async function Rules() {
  const md = await readFile(path.join(process.cwd(), "docs", "build spec", "ANTE-RULEBOOK.md"), "utf8");
  const html = await marked.parse(md);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <Link
            href="/"
            className="text-sm text-[color:var(--color-text-mid)] underline-offset-4 hover:text-[color:var(--color-text-hi)] hover:underline"
          >
            ← theantegame.com
          </Link>
        </div>
        <article className="rulebook panel p-6 sm:p-10" dangerouslySetInnerHTML={{ __html: html }} />
      </main>
    </div>
  );
}
