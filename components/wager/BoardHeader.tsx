import Link from "next/link";

// The Game Board's panel header, in ONE place (D-103).
//
// Three components render this board under the same heading — Titled for the
// waiting states, BetSlip while the week is open, SettledResults once it has paid
// out — and each had its own copy of the header markup. D-102 added the Past Weeks
// door to Titled alone, so it appeared in every state except the one that needed it:
// an open week, where the archive has no other entrance. Shared now, so a change to
// the header cannot reach one state and miss two.
//
// No "use client" and no server-only imports, so it compiles into whichever side
// imports it — BetSlip is a client component, the other two are server components.

export function BoardHeader({
  heading,
  pastWeek,
  pastLabel,
}: {
  heading: string;
  /** Newest REVEALED week; null before any reveal, when there is no past to show. */
  pastWeek: number | null;
  pastLabel: string;
}) {
  return (
    <div className="panel-head flex items-center justify-between gap-3 px-4 py-3">
      <h2 className="font-[family-name:var(--font-display)] font-bold uppercase tracking-[0.16em] text-[color:var(--color-heading)]">
        {heading}
      </h2>
      {pastWeek !== null && (
        <Link
          href={`/results/${pastWeek}`}
          className="chamfer shrink-0 border border-[color:var(--color-border)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-mid)] hover:border-[color:var(--color-gold)] hover:text-[color:var(--color-gold)]"
        >
          {pastLabel}
        </Link>
      )}
    </div>
  );
}
