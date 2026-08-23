import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { marked } from "marked";
import { RulebookNav } from "@/components/rules/RulebookNav";

// /rules — the versioned rulebook, rendered from the repo file (ANTE-ADMIN §4.4's one
// exemption from the content system: the rulebook is the authority and ships with the
// code, so it cannot drift from what the engine implements). Public on purpose — the
// felt card in the tutorial says "open to everyone" (D-036).
//
// D-037: sectioned on the document's own ## headings, with a menu that rides along —
// sticky rail on wide screens, jump list on phones. The markdown is trusted repo
// content compiled by us; next.config.ts traces the file into the serverless bundle.

export const dynamic = "force-static";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

export default async function Rules() {
  const md = await readFile(path.join(process.cwd(), "docs", "build spec", "ANTE-RULEBOOK.md"), "utf8");

  // Split on the document's ## headings. The preamble (title + intro) renders above
  // the first section and is not a menu entry.
  const parts = md.split(/^## /m);
  const preamble = parts[0];
  const sections = await Promise.all(
    parts.slice(1).map(async (chunk) => {
      const nl = chunk.indexOf("\n");
      const title = chunk.slice(0, nl).trim();
      const body = chunk.slice(nl + 1);
      return {
        id: slugify(title),
        title,
        html: await marked.parse(body),
      };
    }),
  );
  const preambleHtml = await marked.parse(preamble);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-[color:var(--color-text-mid)] underline-offset-4 hover:text-[color:var(--color-text-hi)] hover:underline"
          >
            ← theantegame.com
          </Link>
        </div>

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[240px_1fr] lg:items-start lg:gap-10">
          <RulebookNav sections={sections.map(({ id, title }) => ({ id, title }))} />

          <article className="rulebook panel min-w-0 p-6 sm:p-10">
            <div dangerouslySetInnerHTML={{ __html: preambleHtml }} />
            {sections.map((s) => (
              <section key={s.id}>
                {/* scroll-margin keeps the anchored heading clear of the viewport edge */}
                <h2 id={s.id} className="scroll-mt-24">
                  {s.title}
                </h2>
                <div dangerouslySetInnerHTML={{ __html: s.html }} />
              </section>
            ))}
          </article>
        </div>
      </main>
    </div>
  );
}
