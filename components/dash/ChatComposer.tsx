"use client";

import { useRef, useState } from "react";
import { postChatMessage } from "@/app/actions/chat";

// Players were not registering that Table Talk is a live room, so the composer
// announces itself: a pulsing light, gold type, and a shine crossing the field every
// few seconds (D-013). Both animations stop under prefers-reduced-motion.
//
// It is a first-time tell, not decoration: once a player has posted even once they
// know the room is live, so `showLive` goes false and the composer goes quiet for
// good (D-014).
//
// The shine lives in its own clipping layer rather than on a wrapper around the
// input — clipping the input itself would cut off its focus outline.

export function ChatComposer({
  placeholder,
  liveLabel,
  showLive,
}: {
  placeholder: string;
  liveLabel: string;
  showLive: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");

  return (
    <div className="border-t border-[color:var(--color-border)]">
      {showLive && (
        <p className="flex items-center gap-2 px-3 pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-gold)]">
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
          else formRef.current?.reset();
        }}
        className={`flex flex-wrap gap-2 px-3 pb-3 ${showLive ? "pt-2" : "pt-3"}`}
      >
        <span className="relative flex-1">
          <input
            name="body"
            maxLength={2000}
            placeholder={placeholder}
            aria-label={placeholder}
            className="w-full bg-[color:var(--color-surface-2)] px-3 py-2 text-sm text-[color:var(--color-text-hi)] outline-none placeholder:text-[color:var(--color-text-low)] focus:outline-2 focus:outline-[color:var(--color-chrome)]"
          />
          {showLive && (
            <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <span className="shine-loop absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgba(201,162,75,0.28)_50%,transparent_65%)]" />
            </span>
          )}
        </span>

        <button
          type="submit"
          className="chamfer chrome-face px-4 text-sm font-semibold"
          aria-label={placeholder}
        >
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
