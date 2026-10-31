"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { SignOutButton } from "@clerk/nextjs";

interface NavLink {
  href: string;
  label: string;
}

export interface HeaderMenuProps {
  name: string;
  /** "Rank 6 · 400 chips", already composed from content. */
  standing: string;
  help: NavLink[];
  helpLabel: string;
  profileLabel: string;
  menuAria: string;
  accountAria: string;
  commissioner: NavLink | null;
  logoutLabel: string;
}

type Open = "help" | "account" | "sheet" | null;

/** The right side of the dashboard bar (D-125). Computer: Help ▾ and an account menu
 *  (the player's chip and name). Phone: one ☰ that opens a sheet under the bar with
 *  all of it. Menus close on a tap outside, Escape, or choosing an item; arrow
 *  keys move through the items; focus goes back to the button that opened them. */
export function HeaderMenu(props: HeaderMenuProps) {
  const { name, standing, help, helpLabel, profileLabel, menuAria, accountAria, commissioner, logoutLabel } =
    props;
  const [open, setOpen] = useState<Open>(null);
  const root = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const triggers = useRef<Partial<Record<Exclude<Open, null>, HTMLButtonElement | null>>>({});

  const openRef = useRef<Open>(null);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  const close = useCallback((refocus = false) => {
    const was = openRef.current;
    setOpen(null);
    if (refocus && was) triggers.current[was]?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!root.current?.contains(t) && !sheet.current?.contains(t)) close();
    };
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", keys);
    // The first item takes focus, as a menu should.
    const first = `[data-menu="${open}"] [role="menuitem"]`;
    requestAnimationFrame(function focusFirst() {
      document.querySelector<HTMLElement>(first)?.focus();
    });
    // The phone sheet covers the page; the page under it must not scroll.
    if (open === "sheet") document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", keys);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  const toggle = (which: Exclude<Open, null>) => setOpen((o) => (o === which ? null : which));

  /** Up and Down through a menu's items, wrapping. */
  const arrows = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  const initial = (name.match(/[A-Za-z0-9]/)?.[0] ?? "?").toUpperCase();
  const chevron = (up: boolean) => (
    <svg
      aria-hidden
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className={`transition-transform motion-reduce:transition-none ${up ? "rotate-180" : ""}`}
    >
      <path d="M1.5 3.5L5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
  const ring =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-gold)]";

  const dropdown =
    "menu-pop absolute right-0 top-full z-50 mt-3 min-w-56 border border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] py-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.35)]";
  const row =
    "flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm text-[color:var(--color-text-hi)] outline-none hover:bg-[color:var(--color-surface-2)] focus-visible:bg-[color:var(--color-surface-2)]";
  const rule = <div role="separator" className="my-1.5 h-px bg-[color:var(--color-border)] opacity-40" />;

  return (
    <div ref={root} className="flex items-center gap-1 sm:gap-2">
      {/* ── Computer ─────────────────────────────────────────── */}
      <div className="relative hidden sm:block">
        <button
          ref={(el) => {
            triggers.current.help = el;
          }}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open === "help"}
          onClick={() => toggle("help")}
          className={`flex h-10 items-center gap-1.5 px-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-mid)] hover:text-[color:var(--color-text-hi)] ${ring}`}
        >
          {helpLabel}
          {chevron(open === "help")}
        </button>
        {open === "help" && (
          <div
            role="menu"
            data-menu="help"
            aria-label={helpLabel}
            onKeyDown={arrows}
            onClick={() => setOpen(null)}
            className={dropdown}
          >
            {help.map((l) => (
              <Link key={l.href} role="menuitem" href={l.href} className={row}>
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <span aria-hidden className="hidden h-6 w-px bg-[color:var(--color-border)] opacity-40 sm:block" />

      <div className="relative hidden sm:block">
        <button
          ref={(el) => {
            triggers.current.account = el;
          }}
          type="button"
          aria-label={accountAria}
          aria-haspopup="menu"
          aria-expanded={open === "account"}
          onClick={() => toggle("account")}
          className={`flex h-10 items-center gap-2.5 pl-2 pr-1 text-sm font-medium text-[color:var(--color-text-hi)] ${ring}`}
        >
          <span className="chip-avatar flex h-8 w-8 items-center justify-center font-[family-name:var(--font-display)] text-[13px] font-bold">
            {initial}
          </span>
          <span className="max-w-40 truncate">{name}</span>
          <span className="text-[color:var(--color-text-low)]">{chevron(open === "account")}</span>
        </button>
        {open === "account" && (
          <div
            role="menu"
            data-menu="account"
            aria-label={accountAria}
            onKeyDown={arrows}
            onClick={() => setOpen(null)}
            className={dropdown}
          >
            <div className="px-4 pb-2 pt-1.5">
              <p className="truncate text-sm font-semibold text-[color:var(--color-text-hi)]">{name}</p>
              <p className="nums mt-0.5 text-xs text-[color:var(--color-text-low)]">{standing}</p>
            </div>
            {rule}
            <Link role="menuitem" href="/profile" className={row}>
              {profileLabel}
            </Link>
            {commissioner && (
              <Link
                role="menuitem"
                href={commissioner.href}
                className={`${row} !text-[color:var(--color-gold)]`}
              >
                {commissioner.label}
              </Link>
            )}
            {rule}
            <SignOutButton>
              <button role="menuitem" className={`${row} !text-[color:var(--color-text-mid)]`}>
                {logoutLabel}
              </button>
            </SignOutButton>
          </div>
        )}
      </div>

      {/* ── Phone ────────────────────────────────────────────── */}
      <button
        ref={(el) => {
          triggers.current.sheet = el;
        }}
        type="button"
        aria-label={menuAria}
        aria-haspopup="menu"
        aria-expanded={open === "sheet"}
        onClick={() => toggle("sheet")}
        className={`-mr-2 flex h-11 w-11 items-center justify-center text-[color:var(--color-text-hi)] sm:hidden ${ring}`}
      >
        <svg aria-hidden width="22" height="22" viewBox="0 0 22 22">
          {open === "sheet" ? (
            <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </svg>
      </button>
      {/* Portalled to <body>: the frosted bar's backdrop-filter makes it the box that
          fixed children measure from, which would shrink the dim to nothing. */}
      {open === "sheet" &&
        createPortal(
          <div ref={sheet}>
            {/* Under the bar, over the page: a dim the tap-outside lands on. */}
            <div
              aria-hidden
              onClick={() => setOpen(null)}
              className="fixed inset-x-0 bottom-0 top-14 z-40 bg-black/45 sm:hidden"
            />
            <div
              role="menu"
              data-menu="sheet"
              aria-label={menuAria}
              onKeyDown={arrows}
              onClick={() => setOpen(null)}
              className="menu-pop fixed inset-x-0 top-14 z-50 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-1)] pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_16px_40px_rgba(0,0,0,0.4)] sm:hidden"
            >
              <Link
                role="menuitem"
                href="/profile"
                className="flex items-center gap-3 px-5 py-4 outline-none focus-visible:bg-[color:var(--color-surface-2)]"
              >
                <span className="chip-avatar flex h-11 w-11 shrink-0 items-center justify-center font-[family-name:var(--font-display)] text-base font-bold">
                  {initial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-[color:var(--color-text-hi)]">
                    {name}
                  </span>
                  <span className="nums block text-xs text-[color:var(--color-text-low)]">{standing}</span>
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--color-gold)]">
                  {profileLabel}
                </span>
              </Link>
              <div className="h-px bg-[color:var(--color-border)] opacity-40" />
              <p className="px-5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-low)]">
                {helpLabel}
              </p>
              {help.map((l) => (
                <Link key={l.href} role="menuitem" href={l.href} className={`${row} min-h-12 px-5 text-base`}>
                  {l.label}
                  <Chevron />
                </Link>
              ))}
              <div className="mx-5 my-2 h-px bg-[color:var(--color-border)] opacity-40" />
              {commissioner && (
                <Link
                  role="menuitem"
                  href={commissioner.href}
                  className={`${row} min-h-12 px-5 text-base !text-[color:var(--color-gold)]`}
                >
                  {commissioner.label}
                  <Chevron />
                </Link>
              )}
              <SignOutButton>
                <button
                  role="menuitem"
                  className={`${row} min-h-12 px-5 text-base !text-[color:var(--color-text-mid)]`}
                >
                  {logoutLabel}
                </button>
              </SignOutButton>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function Chevron() {
  return (
    <svg
      aria-hidden
      width="8"
      height="12"
      viewBox="0 0 8 12"
      className="shrink-0 text-[color:var(--color-text-low)]"
    >
      <path d="M1.5 1.5L6 6l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
