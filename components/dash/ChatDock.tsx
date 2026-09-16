"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { markChatRead } from "@/app/actions/chat";
import type { ChatPosition } from "@/lib/chat/unread";

// The Table Talk dock (D-086). The room is no longer a panel in the dashboard's
// column; it is a strip that is always on screen — the rectangle at the bottom of
// Facebook that lights up when somebody says something — and it slides open in place.
//
// Three positions, chosen on /profile, each shaped for the screen it is on:
//   corner  desktop: 360px box bottom-right   phone: full-width bar at the bottom
//   bar     desktop: full-width strip         phone: the same bar
//   side    desktop: tab on the right edge    phone: the same tab, opens full screen
//
// Open/closed lives in localStorage so it survives the five-second refresh and the
// next visit. Opening marks the room read (a server action); while open, every
// refresh that brings new messages marks them read too, so the badge only ever
// counts what was said while the dock was shut. The tab title carries the count so
// a background tab shows it, the way a messenger does.

const KEY = "ante.chat.open";
const listeners = new Set<() => void>();
const readOpen = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};
const writeOpen = (v: boolean) => {
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    /* private mode: the dock just starts closed next time */
  }
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function ChatDock({
  position,
  unread,
  badge,
  label,
  newLabel,
  openAria,
  closeAria,
  help,
  children,
}: {
  position: ChatPosition;
  unread: number;
  /** Pre-formatted count for the strip ("3", "50+"), null when nothing is unread. */
  badge: string | null;
  label: string;
  /** "{n} new" with {n} already filled, or "" when nothing is unread. */
  newLabel: string;
  openAria: string;
  closeAria: string;
  /** The circled ? — lives in the dock's own header now. */
  help: ReactNode;
  children: ReactNode;
}) {
  const open = useSyncExternalStore(subscribe, readOpen, () => false);

  // Open = read. Runs on open and again whenever a refresh brings more while open.
  useEffect(() => {
    if (open && unread > 0) void markChatRead();
  }, [open, unread]);

  // The count in the tab title, cleared when the dock is open or the room is caught up.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
    document.title = !open && badge ? `(${badge}) ${base}` : base;
  }, [open, badge]);

  const lit = !open && unread > 0;
  const shown = open ? null : badge;

  // The strip: label on the left (click to toggle), the circled ? right beside it
  // while open, the caret on the right. Two toggle buttons rather than one big one,
  // because the ? is itself a button and a button cannot sit inside a button.
  const dot = (
    <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${lit ? "live-dot bg-[color:var(--color-gold)]" : "bg-[color:var(--color-text-low)]"}`} />
  );
  const strip = (
    <div className={`chrome-face flex items-center ${open ? "h-11" : "h-12"} ${lit ? "dock-lit" : ""}`}>
      <button
        type="button"
        onClick={() => writeOpen(!open)}
        aria-expanded={open}
        aria-label={open ? closeAria : openAria}
        className="flex h-full min-w-0 items-center gap-3 pl-4 pr-2 text-left"
      >
        {dot}
        <span className="font-[family-name:var(--font-display)] text-[15px] font-bold uppercase tracking-[0.14em] sm:text-sm">{label}</span>
        {shown && (
          <span className="chamfer bg-[color:var(--color-gold)] px-2 py-0.5 text-[12px] font-bold text-[color:var(--color-canvas)]">{newLabel}</span>
        )}
      </button>
      {open && <span className="dock-help flex items-center">{help}</span>}
      <button
        type="button"
        onClick={() => writeOpen(!open)}
        aria-label={open ? closeAria : openAria}
        tabIndex={-1}
        className="ml-auto h-full px-4 text-[color:var(--color-text-low)]"
      >
        <span aria-hidden>{open ? "▾" : "▴"}</span>
      </button>
    </div>
  );

  if (position === "side") {
    return (
      <>
        {!open && (
          <button
            type="button"
            onClick={() => writeOpen(true)}
            aria-label={openAria}
            className={`chrome-face fixed right-0 top-1/3 z-40 flex items-center gap-2 px-2 py-4 [writing-mode:vertical-rl] ${lit ? "dock-lit" : ""}`}
          >
            {dot}
            <span className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.14em]">{label}</span>
            {shown && <span className="chamfer bg-[color:var(--color-gold)] px-1.5 py-0.5 text-[12px] font-bold text-[color:var(--color-canvas)]">{shown}</span>}
          </button>
        )}
        {open && (
          <div className="dock-slide-x dock bottom-0 right-0 top-6 z-40 flex w-full flex-col overscroll-contain sm:top-0 sm:w-[380px]">
            {strip}
            <div className="min-h-0 flex-1">{children}</div>
          </div>
        )}
      </>
    );
  }

  const corner = position === "corner";
  const frame = corner
    ? "inset-x-0 bottom-0 z-40 sm:inset-x-auto sm:right-0 sm:w-[360px]"
    : "inset-x-0 bottom-0 z-40";
  // Phone heights use dvh, not vh: on iOS, vh is the viewport with Safari's bars hidden,
  // so an 85vh box anchored to the bottom ran above the visible screen and put the
  // strip out of reach — the room could be opened and never closed. dvh is what is
  // actually visible; 1.5rem is left above so the strip is always a thumb away.
  const openHeight = corner
    ? "h-[calc(100dvh-1.5rem)] sm:h-[min(600px,85vh)]"
    : "h-[calc(100dvh-1.5rem)] sm:h-[60vh]";

  return (
    <div className={`${frame} dock flex flex-col overscroll-contain ${open ? `dock-slide-y ${openHeight}` : ""}`}>
      {strip}
      {open && <div className="min-h-0 flex-1">{children}</div>}
    </div>
  );
}
