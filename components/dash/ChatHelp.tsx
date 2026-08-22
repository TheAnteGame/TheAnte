"use client";

import { useEffect, useRef, useState } from "react";

// The circled ? in Table Talk's header (D-033). Mentions and emoji exist but nothing
// told players so — a one-tap explainer beats a support message. Pure disclosure:
// no server reads, copy arrives from the content system via props.

export function ChatHelp({
  ariaLabel,
  title,
  mentionsLine,
  emojiLine,
}: {
  ariaLabel: string;
  title: string;
  mentionsLine: string;
  emojiLine: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--color-text-low)] text-[12px] font-semibold text-[color:var(--color-text-mid)] hover:border-[color:var(--color-chrome)] hover:text-[color:var(--color-text-hi)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-chrome)]"
      >
        ?
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 border border-[color:var(--color-border)] bg-[color:var(--color-surface-3)] p-4 shadow-[0_8px_28px_rgba(0,0,0,0.55)]">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-gold)]">{title}</p>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-text-mid)]">{mentionsLine}</p>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-text-mid)]">{emojiLine}</p>
        </div>
      )}
    </div>
  );
}
