"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// The circled ? in Table Talk's strip (D-033). Copy arrives from the content system
// via props; no server reads.
//
// The panel is PORTALLED to <body> (D-098). It used to be an absolutely-positioned
// child of the strip, which put it in the dock's stacking context alongside every
// player name and name-tooltip in the room — and it lost to them. Raising its
// z-index fixed that in isolation and not in the room, so the layering argument is
// abandoned rather than re-tuned: out here there is nothing in the chat that can be
// painted over it, whatever the dock does. Placed from the trigger's own rectangle,
// measured on the click so it never paints at the wrong spot first.

const WIDTH = 288; // w-72, fixed so the left edge can be computed before paint
const MARGIN = 12;

export function ChatHelp({
  ariaLabel,
  title,
  mentionsLine,
  emojiLine,
  formatLine,
  gifLine,
}: {
  ariaLabel: string;
  title: string;
  mentionsLine: string;
  emojiLine: string;
  formatLine: string;
  gifLine: string;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Hung from the trigger's right edge, then kept inside the viewport — on a phone
  // the strip sits at the very bottom, so the panel opens upward when it has to.
  const place = () => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const left = Math.min(Math.max(MARGIN, b.right - WIDTH), window.innerWidth - WIDTH - MARGIN);
    const below = window.innerHeight - b.bottom;
    const top = below < 260 ? Math.max(MARGIN, b.top - 8 - Math.min(420, b.top - MARGIN)) : b.bottom + 8;
    setAt({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    // Capture: the room and the page both scroll, and neither bubbles a scroll event.
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          place();
          setOpen(true);
        }}
        aria-label={ariaLabel}
        aria-expanded={open}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--color-text-low)] text-[12px] font-semibold text-[color:var(--color-text-mid)] hover:border-[color:var(--color-chrome)] hover:text-[color:var(--color-text-hi)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-chrome)]"
      >
        ?
      </button>

      {open &&
        at &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={title}
            style={{ top: at.top, left: at.left, width: WIDTH }}
            className="fixed z-[100] max-h-[70vh] overflow-y-auto overscroll-contain border border-[color:var(--color-border)] bg-[color:var(--color-surface-3)] p-4 shadow-[0_8px_28px_rgba(0,0,0,0.55)]"
          >
            <p className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--color-gold)]">{title}</p>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-text-mid)]">{mentionsLine}</p>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-text-mid)]">{emojiLine}</p>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-text-mid)]">{formatLine}</p>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-text-mid)]">{gifLine}</p>
          </div>,
          document.body,
        )}
    </>
  );
}
