"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { reactToMessage } from "@/app/actions/chat";
import { applyPick, REACTIONS, type MessageReactions, type ReactionKind } from "@/lib/chat/reactions";

export interface ReactCopy {
  add: string;
  labels: Record<ReactionKind, string>;
}

/** Press and hold (touch only). A mouse has hover and the + button instead, and must
 *  keep ordinary text selection. Movement cancels it, so a scroll never opens a menu. */
function useLongPress(onLong: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(10);
        onLong();
      }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    // The finger lifting after a long press must not also follow a link or toggle a chip.
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
    onContextMenu: (e: React.MouseEvent) => {
      if (timer.current || fired.current) e.preventDefault();
    },
  };
}

/** A Table Talk message that can be reacted to (D-123): chips under it with counts,
 *  a picker from press-and-hold (phone) or the + that appears on hover (computer).
 *  One reaction per player; the on-screen answer is instant and the server's own
 *  render, every few seconds, is the truth. */
export function Reactable({
  messageId,
  initial,
  myName,
  canReact,
  copy,
  children,
}: {
  messageId: string;
  initial: MessageReactions;
  myName: string;
  canReact: boolean;
  copy: ReactCopy;
  children: React.ReactNode;
}) {
  const [state, setOptimistic] = useOptimistic(initial, (s: MessageReactions, kind: ReactionKind | null) => applyPick(s, kind, myName));
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [whoFor, setWhoFor] = useState<ReactionKind | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const pick = (kind: ReactionKind) => {
    if (!canReact) return;
    const next = state.mine === kind ? null : kind;
    setOpen(false);
    start(async () => {
      setOptimistic(next);
      await reactToMessage(messageId, next);
    });
  };

  // Close the picker or the names on a tap anywhere else, or Escape.
  useEffect(() => {
    if (!open && !whoFor) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) {
        setOpen(false);
        setWhoFor(null);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setWhoFor(null);
      }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, whoFor]);

  const press = useLongPress(() => canReact && setOpen(true));

  return (
    <div
      ref={box}
      className="group relative [-webkit-touch-callout:none] [@media(hover:none)]:select-none"
      {...press}
    >
      {children}
      {canReact && (
        <button
          type="button"
          aria-label={copy.add}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="absolute -top-4 right-1 z-10 hidden h-7 w-7 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] text-sm text-[color:var(--color-text-mid)] opacity-0 transition-opacity hover:text-[color:var(--color-text-hi)] focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:flex"
        >
          +
        </button>
      )}
      {open && (
        <div
          role="menu"
          aria-label={copy.add}
          className="absolute -top-10 right-0 z-20 flex gap-1 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-2 py-1 shadow-lg"
        >
          {REACTIONS.map((r) => (
            <button
              key={r.kind}
              type="button"
              role="menuitemradio"
              aria-checked={state.mine === r.kind}
              aria-label={copy.labels[r.kind]}
              onClick={() => pick(r.kind)}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-xl transition-transform hover:scale-125 ${
                state.mine === r.kind ? "bg-[color:var(--color-surface)] ring-1 ring-[color:var(--color-gold)]" : ""
              }`}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}
      {state.chips.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {state.chips.map((c) => (
            <Chip
              key={c.kind}
              emoji={c.emoji}
              count={c.count}
              mine={state.mine === c.kind}
              label={`${copy.labels[c.kind]}: ${c.names.join(", ")}`}
              disabled={!canReact}
              onTap={() => pick(c.kind)}
              onHold={() => setWhoFor(c.kind)}
            />
          ))}
        </div>
      )}
      {whoFor && (
        <p className="mt-1 text-xs text-[color:var(--color-text-low)]">
          {state.chips.find((c) => c.kind === whoFor)?.emoji} {state.chips.find((c) => c.kind === whoFor)?.names.join(", ")}
        </p>
      )}
    </div>
  );
}

/** Tap: add or take off yours. Press and hold: who reacted. Hover (computer): the
 *  same names, as the title. */
function Chip({
  emoji,
  count,
  mine,
  label,
  disabled,
  onTap,
  onHold,
}: {
  emoji: string;
  count: number;
  mine: boolean;
  label: string;
  disabled: boolean;
  onTap: () => void;
  onHold: () => void;
}) {
  const press = useLongPress(onHold);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={mine}
      onClick={disabled ? undefined : onTap}
      {...press}
      // Holding a chip asks who reacted; it must not also open the message's picker.
      onPointerDown={(e) => {
        e.stopPropagation();
        press.onPointerDown(e);
      }}
      className={`nums flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
        mine
          ? "border-[color:var(--color-gold)] bg-[color:var(--color-surface-2)] text-[color:var(--color-text-hi)]"
          : "border-[color:var(--color-border)] text-[color:var(--color-text-mid)]"
      } ${disabled ? "cursor-default" : "hover:border-[color:var(--color-chrome)]"}`}
    >
      <span aria-hidden>{emoji}</span>
      <span aria-hidden>{count}</span>
    </button>
  );
}
