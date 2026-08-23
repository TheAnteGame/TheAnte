import Link from "next/link";
import { getContent } from "@/lib/content/getContent";

// Q&A under the leaderboard (D-037): the ten questions the room actually asks,
// answered in the rulebook's own words, each expandable. Native <details> — no
// client JS, keyboard-accessible for free, and the panel stays honest: every
// answer ends where the rulebook begins, and the full document is one tap away.

const QA_COUNT = 10;

export async function RuleBookQA() {
  const [heading, moreLabel, ...pairs] = await Promise.all([
    getContent("faq.heading"),
    getContent("faq.more"),
    ...Array.from({ length: QA_COUNT }, (_, i) =>
      Promise.all([getContent(`faq.q${i + 1}`), getContent(`faq.a${i + 1}`)]),
    ),
  ]);

  return (
    <section aria-label={heading} className="panel">
      <h2 className="panel-head px-4 py-3 font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-chrome)]">
        {heading}
      </h2>
      <ul>
        {(pairs as Array<[string, string]>).map(([q, a]) => (
          <li key={q} className="border-b border-[color:var(--color-border)] last:border-b-0">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-baseline gap-3 px-4 py-3 text-sm font-semibold text-[color:var(--color-text-hi)] hover:bg-[color:var(--color-surface-2)] [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="shrink-0 text-[color:var(--color-gold)] transition-transform group-open:rotate-90">
                  ▸
                </span>
                {q}
              </summary>
              <p className="px-4 pb-4 pl-9 text-sm leading-relaxed text-[color:var(--color-text-mid)]">{a}</p>
            </details>
          </li>
        ))}
      </ul>
      <p className="px-4 py-3">
        <Link
          href="/rules"
          className="text-sm text-[color:var(--color-gold)] underline-offset-4 hover:underline"
        >
          {moreLabel}
        </Link>
      </p>
    </section>
  );
}
