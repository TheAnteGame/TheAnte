import type { ReactNode } from "react";

// One tooltip, CSS-only, for surfaces that need to explain themselves without
// shipping client JS (D-045). Hover OR focus-within, the same pair the bet slip
// already uses: a phone has no hover, so a hover-only tooltip is invisible to most
// of the league. The trigger is a real <button> precisely so a tap focuses it.
//
// Everything inside the trigger must be phrasing content — a <button> cannot legally
// contain a <div>. Callers pass spans.

export function Tip({
  text,
  label,
  children,
  align = "left",
}: {
  /** The explanation. */
  text: string;
  /** What the trigger is, for screen readers, ahead of the explanation. */
  label: string;
  children: ReactNode;
  /** Which edge to hang from — "right" keeps a right-hand tray on screen. */
  align?: "left" | "right";
}) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={`${label}. ${text}`}
        className="cursor-help rounded-none text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-chrome)]"
      >
        {children}
      </button>
      {/* Never wider than the viewport it has to fit inside. */}
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-50 mt-2 hidden w-[min(20rem,calc(100vw-3rem))] border border-[color:var(--color-border)] bg-[color:var(--color-surface-3)] px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-[color:var(--color-text-mid)] shadow-lg group-hover:block group-focus-within:block ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {text}
      </span>
    </span>
  );
}
