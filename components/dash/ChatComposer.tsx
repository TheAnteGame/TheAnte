"use client";

import { useRef, useState } from "react";
import { postChatMessage } from "@/app/actions/chat";
import type { Handle } from "@/lib/chat/mentions";

// Players were not registering that Table Talk is a live room, so the composer
// announces itself: a pulsing light, gold type, and a shine crossing the field every
// few seconds (D-013). Both animations stop under prefers-reduced-motion.
//
// It is a first-time tell, not decoration: once a player has posted even once they
// know the room is live, so `showLive` goes false and the composer goes quiet for
// good (D-014).
//
// Typing "@" opens the roster (D-019). Handles come from the server so the picker,
// the highlighting and the email all agree on who "@Robert" is.

// Fixed strip, league register — one tap for the desktop users who never find the OS
// emoji shortcut. Data, not copy: the content grep ignores non-letter JSX.
const EMOJIS = ["🏈", "🔥", "😂", "💀", "🤝", "🎉", "😤", "🧊"];

export function ChatComposer({
  placeholder,
  liveLabel,
  showLive,
  handles,
  emojiAria,
}: {
  placeholder: string;
  liveLabel: string;
  showLive: boolean;
  handles: Handle[];
  emojiAria: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [value, setValue] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // The "@word" immediately before the caret, if there is one.
  const readQuery = (text: string, caret: number) => {
    const upto = text.slice(0, caret);
    const m = upto.match(/@([A-Za-z0-9]*)$/);
    return m ? m[1] : null;
  };

  const matches =
    query === null
      ? []
      : handles.filter((h) => h.handle.toLowerCase().startsWith(query.toLowerCase())).slice(0, 6);

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? value.length;
    const next = value.slice(0, caret) + emoji + value.slice(caret);
    setValue(next);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret + emoji.length, caret + emoji.length);
    });
  };

  const insert = (handle: string) => {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@([A-Za-z0-9]*)$/, `@${handle} `);
    const next = before + value.slice(caret);
    setValue(next);
    setQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(before.length, before.length);
    });
  };

  return (
    <div className="border-t border-[color:var(--color-border)]">
      {showLive && (
        <p className="flex items-center gap-2 px-3 pt-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-gold)]">
          <span aria-hidden className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-gold)]" />
          {liveLabel}
        </p>
      )}

      <form
        ref={formRef}
        action={async (fd) => {
          setError("");
          const result = await postChatMessage(fd);
          if (!result.ok && result.error) setError(result.error);
          else {
            formRef.current?.reset();
            setValue("");
            setQuery(null);
          }
        }}
        className={`flex flex-wrap gap-2 px-3 pb-3 ${showLive ? "pt-2" : "pt-3"}`}
      >
        <span className="relative flex-1">
          {matches.length > 0 && (
            <ul className="absolute bottom-full left-0 z-30 mb-1 w-56 border border-[color:var(--color-border)] bg-[color:var(--color-surface-3)] py-1 shadow-lg">
              {matches.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insert(h.handle);
                    }}
                    className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-[color:var(--color-surface-2)]"
                  >
                    <span className="font-semibold text-[color:var(--color-gold)]">@{h.handle}</span>
                    <span className="text-xs text-[color:var(--color-text-low)]">{h.display}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <input
            ref={inputRef}
            name="body"
            maxLength={2000}
            autoComplete="off"
            placeholder={placeholder}
            aria-label={liveLabel}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setQuery(readQuery(e.target.value, e.target.selectionStart ?? e.target.value.length));
            }}
            onBlur={() => setQuery(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery(null);
              // Enter takes the only remaining match rather than posting a half-typed name.
              if (e.key === "Enter" && matches.length === 1) {
                e.preventDefault();
                insert(matches[0].handle);
              }
            }}
            className="w-full bg-[color:var(--color-surface-2)] px-3 py-2 text-sm text-[color:var(--color-text-hi)] outline-none placeholder:text-[color:var(--color-text-low)] focus:outline-2 focus:outline-[color:var(--color-chrome)]"
          />

          {showLive && (
            <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <span className="shine-loop absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgba(201,162,75,0.28)_50%,transparent_65%)]" />
            </span>
          )}
        </span>

        <span className="relative">
          <button
            type="button"
            onClick={() => setEmojiOpen((o) => !o)}
            aria-label={emojiAria}
            aria-expanded={emojiOpen}
            className="chamfer h-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 text-sm hover:border-[color:var(--color-chrome-dim)] hover:bg-[color:var(--color-surface-3)]"
          >
            <span aria-hidden>🙂</span>
          </button>
          {emojiOpen && (
            <span className="absolute bottom-full right-0 z-30 mb-1 flex gap-1 border border-[color:var(--color-border)] bg-[color:var(--color-surface-3)] p-1.5 shadow-lg">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  // click, not mousedown: Enter/Space dispatch click, so the strip
                  // works from the keyboard; mousedown only stops the focus steal.
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => insertEmoji(e)}
                  className="px-1 text-lg leading-none hover:scale-110"
                >
                  {e}
                </button>
              ))}
            </span>
          )}
        </span>

        <button type="submit" className="chamfer chrome-face px-4 text-sm font-semibold" aria-label={placeholder}>
          →
        </button>

        {error && (
          <p role="alert" className="w-full text-xs text-[color:var(--color-loss)]">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
