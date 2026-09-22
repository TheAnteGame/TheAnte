"use client";

import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";

// One tooltip for surfaces that need to explain themselves. Desktop: hover, as
// before. Everywhere: TAP toggles it (D-090) — the CSS-only version relied on a tap
// focusing the button, which Android does and iOS Safari never has, so most of the
// league's phones saw nothing. One open at a time; a tap anywhere else, a second
// tap, or Escape closes it. The trigger carries a small mark so a phone user can
// tell a figure is tappable at all; names use a dotted underline instead.
//
// Everything inside the trigger must be phrasing content — a <button> cannot legally
// contain a <div>. Callers pass spans.

const OPEN_EVENT = "ante-tip-open";

export function Tip({
  text,
  label,
  children,
  align = "left",
  className,
  marker = "info",
  href,
}: {
  /** The explanation. */
  text: string;
  /** What the trigger is, for screen readers, ahead of the explanation. */
  label: string;
  children: ReactNode;
  /** Which edge to hang from — "right" keeps a right-hand tray on screen. */
  align?: "left" | "right";
  /** Extra classes on the root, for grid placement (D-087). */
  className?: string;
  /** How the trigger shows it can be tapped: a small ⓘ, a dotted underline, or nothing. */
  marker?: "info" | "underline" | "none";
  /** Makes the trigger a LINK rather than a toggle: the click navigates and the
   *  tray becomes hover-only explanation (D-104). Used for player names, where the
   *  destination carries everything the tray says and more, so a phone tap is
   *  better spent going there than opening a card. */
  href?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const root = document.getElementById(id);
      if (root && !root.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Another tip opening closes this one.
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOther);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOther);
    };
  }, [open, id]);

  const toggle = () => {
    if (!open) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    setOpen((o) => !o);
  };

  return (
    <span id={id} className={`group relative inline-flex ${className ?? ""}`}>
      {href ? (
        <Link
          href={href}
          aria-label={`${label}. ${text}`}
          className={`relative rounded-none text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-chrome)] ${
            marker === "underline" ? "underline decoration-dotted decoration-[color:var(--color-text-low)] underline-offset-4" : ""
          }`}
        >
          {children}
        </Link>
      ) : (
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`${label}. ${text}`}
        className={`relative cursor-help rounded-none text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-chrome)] ${
          marker === "underline" ? "underline decoration-dotted decoration-[color:var(--color-text-low)] underline-offset-4" : ""
        }`}
      >
        {children}
        {/* The trays are block-level wells, so the mark pins to the corner rather
            than trailing the content onto a second line. */}
        {marker === "info" && (
          <span aria-hidden className="pointer-events-none absolute right-1.5 top-1 text-[10px] leading-none text-white/55">
            ⓘ
          </span>
        )}
      </button>
      )}
      {/* Never wider than the viewport it has to fit inside. */}
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-50 mt-2 w-[min(20rem,calc(100vw-3rem))] border border-[color:var(--color-border)] bg-[color:var(--color-surface-3)] px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-[color:var(--color-text-mid)] shadow-lg group-hover:block ${
          open ? "block" : "hidden"
        } ${align === "right" ? "right-0" : "left-0"}`}
      >
        {text}
      </span>
    </span>
  );
}
