"use client";

import { useEffect, useState } from "react";

// The rulebook's section menu (D-037). Sticky beside the document on wide screens,
// a collapsible jump list above it on phones. Scroll position drives the highlight:
// the topmost section crossing the upper third of the viewport is "where you are".

export function RulebookNav({ sections }: { sections: Array<{ id: string; title: string }> }) {
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const headings = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    if (headings.length === 0) return;

    const pick = () => {
      // The last heading above the viewport's upper third wins; before the first
      // heading, the first section is active.
      const line = window.innerHeight / 3;
      let current = headings[0].id;
      for (const h of headings) {
        if (h.getBoundingClientRect().top <= line) current = h.id;
        else break;
      }
      setActive(current);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick);
    return () => {
      window.removeEventListener("scroll", pick);
      window.removeEventListener("resize", pick);
    };
  }, [sections]);

  const links = (
    <ol className="flex flex-col gap-0.5">
      {sections.map((s) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            onClick={() => setOpen(false)}
            aria-current={active === s.id ? "location" : undefined}
            className={`block border-l-2 px-3 py-1.5 text-[13px] leading-snug transition-colors ${
              active === s.id
                ? "border-[color:var(--color-gold)] bg-[color:var(--color-surface-2)] text-[color:var(--color-text-hi)]"
                : "border-transparent text-[color:var(--color-text-mid)] hover:border-[color:var(--color-border)] hover:text-[color:var(--color-text-hi)]"
            }`}
          >
            {s.title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      {/* Phone: a jump menu that closes on pick. */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="chamfer w-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] px-4 py-2.5 text-left text-sm font-semibold text-[color:var(--color-text-hi)]"
        >
          {sections.find((s) => s.id === active)?.title ?? sections[0]?.title}
          <span aria-hidden className="float-right text-[color:var(--color-text-low)]">
            {open ? "▲" : "▼"}
          </span>
        </button>
        {open && (
          <nav className="border border-t-0 border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] py-2">
            {links}
          </nav>
        )}
      </div>

      {/* Wide: sticky rail that rides along as the document scrolls. */}
      <nav className="hidden max-h-[calc(100vh-4rem)] overflow-y-auto py-1 lg:sticky lg:top-8 lg:block">
        {links}
      </nav>
    </>
  );
}
