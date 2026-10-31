"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";

interface NavLink {
  href: string;
  label: string;
}

/** The right side of the dashboard header (D-124). Computer: a stack — the player's
 *  name (their Profile), Help (a menu: How to Play, Tutorial, FAQ), the console for the
 *  commissioner, Log out. Phone: one ☰ that holds all of it, so the masthead is just
 *  the logo, the rank box and the menu. */
export function HeaderMenu({
  name,
  help,
  helpLabel,
  menuAria,
  commissioner,
  logoutLabel,
}: {
  name: string;
  help: NavLink[];
  helpLabel: string;
  menuAria: string;
  commissioner: NavLink | null;
  logoutLabel: string;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!helpOpen && !menuOpen) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!helpRef.current?.contains(t)) setHelpOpen(false);
      if (!menuRef.current?.contains(t)) setMenuOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setHelpOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [helpOpen, menuOpen]);

  const panel =
    "absolute right-0 top-full z-50 mt-2 flex min-w-48 flex-col border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] py-1 text-left shadow-lg";
  const item =
    "block px-4 py-2.5 text-sm text-[color:var(--color-text-hi)] hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-chrome)]";
  const commishCls =
    "chamfer border border-[color:var(--color-gold-dim)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-gold)] hover:bg-[color:var(--color-surface-2)]";

  return (
    <>
      {/* Computer */}
      <div className="hidden flex-col items-end gap-1.5 sm:flex">
        <Link href="/profile" className="text-sm font-medium text-[color:var(--color-text-hi)] underline-offset-4 hover:underline">
          {name}
        </Link>
        <div ref={helpRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((o) => !o)}
            className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-low)] hover:text-[color:var(--color-gold)]"
          >
            {helpLabel}
            <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className={`transition-transform ${helpOpen ? "rotate-180" : ""}`}>
              <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          {helpOpen && (
            <div role="menu" className={panel}>
              {help.map((l) => (
                <Link key={l.href} role="menuitem" href={l.href} className={item} onClick={() => setHelpOpen(false)}>
                  {l.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        {commissioner && (
          <Link href={commissioner.href} className={commishCls}>
            {commissioner.label}
          </Link>
        )}
        <SignOutButton>
          <button className="text-xs text-[color:var(--color-text-low)] underline-offset-4 hover:text-[color:var(--color-text-mid)] hover:underline">
            {logoutLabel}
          </button>
        </SignOutButton>
      </div>

      {/* Phone */}
      <div ref={menuRef} className="relative sm:hidden">
        <button
          type="button"
          aria-label={menuAria}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-11 w-11 items-center justify-center border border-[color:var(--color-border)] text-[color:var(--color-text-hi)]"
        >
          <svg aria-hidden width="20" height="20" viewBox="0 0 20 20">
            {menuOpen ? (
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
        {menuOpen && (
          <div role="menu" className={`${panel} min-w-56`}>
            <Link role="menuitem" href="/profile" className={`${item} font-semibold`} onClick={() => setMenuOpen(false)}>
              {name}
            </Link>
            <div className="my-1 h-px bg-[color:var(--color-border)] opacity-60" />
            {help.map((l) => (
              <Link key={l.href} role="menuitem" href={l.href} className={item} onClick={() => setMenuOpen(false)}>
                {l.label}
              </Link>
            ))}
            {commissioner && (
              <>
                <div className="my-1 h-px bg-[color:var(--color-border)] opacity-60" />
                <Link role="menuitem" href={commissioner.href} className={item.replace("text-[color:var(--color-text-hi)]", "text-[color:var(--color-gold)]")} onClick={() => setMenuOpen(false)}>
                  {commissioner.label}
                </Link>
              </>
            )}
            <div className="my-1 h-px bg-[color:var(--color-border)] opacity-60" />
            <SignOutButton>
              <button role="menuitem" className={`${item.replace("text-[color:var(--color-text-hi)]", "text-[color:var(--color-text-mid)]")} w-full text-left`}>
                {logoutLabel}
              </button>
            </SignOutButton>
          </div>
        )}
      </div>
    </>
  );
}
