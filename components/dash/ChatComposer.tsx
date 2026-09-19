"use client";

import { useRef, useState, useSyncExternalStore } from "react";
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
//
// Multi-line since D-084: a textarea that grows with the message. On a keyboard-and-
// mouse device Enter sends and Shift+Enter breaks the line, the way every desktop
// chat works; on a touch device Return breaks the line and the arrow sends, the way
// every phone messenger works — a phone keyboard has no Shift+Enter. Bullets are
// typed, not inserted: "- " at the start of a line (lib/chat/format.ts).

// Fixed strip, league register — one tap for the desktop users who never find the OS
// emoji shortcut. Data, not copy: the content grep ignores non-letter JSX.
const EMOJIS = ["🏈", "🔥", "😂", "💀", "🤝", "🎉", "😤", "🧊"];
const FINE_POINTER = "(hover: hover) and (pointer: fine)";

interface Gif {
  id: string;
  preview: string;
  url: string;
}

export function ChatComposer({
  placeholder,
  liveLabel,
  showLive,
  handles,
  emojiAria,
  gifEnabled,
  gifAria,
  gifPlaceholder,
  gifRemoveAria,
}: {
  placeholder: string;
  liveLabel: string;
  showLive: boolean;
  handles: Handle[];
  emojiAria: string;
  /** False until GIPHY_API_KEY is set on the server — the button is simply absent. */
  gifEnabled: boolean;
  gifAria: string;
  gifPlaceholder: string;
  gifRemoveAria: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState("");
  const [value, setValue] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  // GIF picker (D-094): search the provider through our own route, pick one, and the
  // message posts at once with the link on its own line under whatever was typed.
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [gifBusy, setGifBusy] = useState(false);
  const searchGifs = async (q: string) => {
    setGifBusy(true);
    try {
      const res = await fetch(`/api/gif?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { gifs?: Gif[]; error?: string };
      setGifs(data.gifs ?? []);
      if (data.error) setError(data.error);
    } catch {
      setGifs([]);
    } finally {
      setGifBusy(false);
    }
  };
  const openGifs = () => {
    setEmojiOpen(false);
    setGifOpen((o) => !o);
    if (!gifOpen && gifs.length === 0) void searchGifs("");
  };
  // Picking a GIF stages it (D-094 follow-up): it shows above the box with an × and
  // goes out with the arrow or Enter, under whatever was typed — nobody posts a meme
  // they have not looked at first.
  const [pending, setPending] = useState<Gif | null>(null);
  const pickGif = (g: Gif) => {
    setPending(g);
    setGifOpen(false);
    inputRef.current?.focus();
  };
  const withGif = (body: string) => (pending ? `${body.trim()}\n${pending.url}`.trim() : body);
  // Keyboard-and-mouse device or not — subscribed, not set-in-effect (the pattern the
  // tutorial uses for reduced motion): SSR gets a stable false, a laptop that docks a
  // mouse mid-session flips live, and there is no cascading first render.
  const enterSends = useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(FINE_POINTER);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(FINE_POINTER).matches,
    () => false,
  );

  // One line at rest, taller as the message grows, never past six lines or so.
  const fit = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  };

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
          fd.set("body", withGif(String(fd.get("body") ?? "")));
          const result = await postChatMessage(fd);
          if (!result.ok && result.error) setError(result.error);
          else {
            formRef.current?.reset();
            setValue("");
            setPending(null);
            setQuery(null);
            fit(inputRef.current);
          }
        }}
        className={`flex flex-wrap gap-2 px-3 pb-3 ${showLive ? "pt-2" : "pt-3"}`}
      >
        {pending && (
          <span className="flex w-full items-start gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- provider-hosted GIF preview */}
            <img src={pending.preview} alt="" className="max-h-32 border border-[color:var(--color-border)]" />
            <button
              type="button"
              onClick={() => setPending(null)}
              aria-label={gifRemoveAria}
              className="chamfer border border-[color:var(--color-border)] px-2 py-1 text-xs text-[color:var(--color-text-mid)] hover:border-[color:var(--color-loss)] hover:text-[color:var(--color-loss)]"
            >
              ×
            </button>
          </span>
        )}
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

          <textarea
            ref={inputRef}
            name="body"
            rows={1}
            maxLength={2000}
            autoComplete="off"
            placeholder={placeholder}
            aria-label={liveLabel}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setQuery(readQuery(e.target.value, e.target.selectionStart ?? e.target.value.length));
              fit(e.target);
            }}
            onBlur={() => setQuery(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery(null);
              if (e.key !== "Enter") return;
              // Enter takes the only remaining match rather than posting a half-typed name.
              if (matches.length === 1) {
                e.preventDefault();
                insert(matches[0].handle);
                return;
              }
              // Desktop: Enter sends, Shift+Enter breaks the line. Touch: Return breaks
              // the line and the arrow sends. A blank message never posts from a key.
              if (enterSends && !e.shiftKey) {
                e.preventDefault();
                if (value.trim().length > 0 || pending) formRef.current?.requestSubmit();
              }
            }}
            className="block w-full resize-none bg-[color:var(--color-surface-2)] px-3 py-2 text-sm leading-5 text-[color:var(--color-text-hi)] outline-none placeholder:text-[color:var(--color-text-low)] focus:outline-2 focus:outline-[color:var(--color-chrome)]"
          />

          {showLive && (
            <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <span className="shine-loop absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgba(201,162,75,0.28)_50%,transparent_65%)]" />
            </span>
          )}
        </span>

        {gifEnabled && (
          <span className="relative">
            <button
              type="button"
              onClick={openGifs}
              aria-label={gifAria}
              aria-expanded={gifOpen}
              className="chamfer h-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-2.5 text-[11px] font-bold uppercase tracking-wider hover:border-[color:var(--color-chrome-dim)] hover:bg-[color:var(--color-surface-3)]"
            >
              <span aria-hidden>GIF</span>
            </button>
            {gifOpen && (
              <span className="absolute bottom-full right-0 z-30 mb-1 flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-2 border border-[color:var(--color-border)] bg-[color:var(--color-surface-3)] p-2 shadow-lg">
                <input
                  value={gifQuery}
                  onChange={(e) => setGifQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void searchGifs(gifQuery);
                    }
                    if (e.key === "Escape") setGifOpen(false);
                  }}
                  placeholder={gifPlaceholder}
                  aria-label={gifPlaceholder}
                  autoFocus
                  className="w-full bg-[color:var(--color-surface-2)] px-2 py-1.5 text-sm text-[color:var(--color-text-hi)] outline-none placeholder:text-[color:var(--color-text-low)] focus:outline-2 focus:outline-[color:var(--color-chrome)]"
                />
                {/* Fixed-height tiles, whole GIF fitted inside on a dark backing: even rows,
                    and the words on a meme are readable before it is chosen. */}
                <span className={`grid max-h-[26rem] grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain ${gifBusy ? "opacity-50" : ""}`}>
                  {gifs.map((g) => (
                    <button key={g.id} type="button" onClick={() => pickGif(g)} className="block h-40 w-full overflow-hidden bg-black/60 hover:outline hover:outline-2 hover:outline-[color:var(--color-gold)]">
                      {/* eslint-disable-next-line @next/next/no-img-element -- provider-hosted preview, not an optimisable asset */}
                      <img src={g.preview} alt="" loading="lazy" className="block h-full w-full object-contain" />
                    </button>
                  ))}
                </span>
              </span>
            )}
          </span>
        )}

        <span className="relative">
          <button
            type="button"
            onClick={() => {
              setGifOpen(false);
              setEmojiOpen((o) => !o);
            }}
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
