"use client";

import { useEffect, useState } from "react";

type Item = { id: string; title: string; url: string | null; source: string | null };

// One headline at a time, with a blank beat between them (D-076, replacing D-052/D-053).
//
// Two earlier attempts tried to make overlap UNLIKELY — a longer gap, a keyed node, a
// self-cancelling chain of nested timeouts. It kept happening. This makes overlap
// IMPOSSIBLE instead, by removing the thing that allowed it: at no point does the
// component describe two stories. There is one index, one element, and during the gap
// there is no story element at all.
//
// The cycle is a two-phase state machine driven by a SINGLE timeout that is recreated
// from scratch on every phase change and cleared by the same effect's cleanup:
//
//     show (holdMs) -> blank (gapMs) -> show the NEXT one -> ...
//
// The index only ever advances while the slot is blank, so a swap cannot be seen. And
// because exactly one timeout exists at any moment, nothing can advance twice, strand
// a half-fade, or fire into an unmounted box — the failure modes the chain had.

const FADE_MS = 300;
const GAP_MS = 1000;

export function NewsFader({
  items,
  rotateMs,
  sourceLabel,
}: {
  items: Item[];
  rotateMs: number;
  sourceLabel: string;
}) {
  // Frozen at mount. The dashboard polls with router.refresh() every five seconds and
  // hands this a freshly fetched array; usually identical, but when a story lands the
  // ORDER shifts and the visible item would change underneath the fade. News can wait
  // for the next real page load.
  const [list] = useState<Item[]>(items);
  const [index, setIndex] = useState(0);
  const [showing, setShowing] = useState(true);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (paused || list.length <= 1) return;

    // Reduced motion: no fade, no blank beat — just swap on a plain interval.
    if (reduced) {
      const t = setTimeout(() => setIndex((i) => (i + 1) % list.length), rotateMs);
      return () => clearTimeout(t);
    }

    const t = setTimeout(
      () => {
        if (showing) {
          setShowing(false);
        } else {
          // Advance ONLY while blank. This is the line that makes overlap impossible.
          setIndex((i) => (i + 1) % list.length);
          setShowing(true);
        }
      },
      showing ? rotateMs : GAP_MS,
    );
    return () => clearTimeout(t);
  }, [showing, index, paused, reduced, rotateMs, list.length]);

  const item = list[index];
  if (!item) return null;

  const headline = "leading-snug text-[color:var(--color-text-hi)]";

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // Holds its height across the blank beat — three headline lines plus the source
      // line — so the column below never jumps.
      className="min-h-[7.5rem] px-4 py-4 text-sm"
    >
      <div
        style={{
          opacity: showing ? 1 : 0,
          transition: reduced ? "none" : `opacity ${FADE_MS}ms ease-in-out`,
        }}
      >
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className={`line-clamp-3 ${headline} underline-offset-4 hover:underline`}
          >
            {item.title}
          </a>
        ) : (
          <span className={`line-clamp-3 ${headline}`}>{item.title}</span>
        )}
        {item.source && (
          <p className="mt-2 text-xs text-[color:var(--color-text-low)]">
            {sourceLabel}:{" "}
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="text-[color:var(--color-text-mid)] underline-offset-4 hover:text-[color:var(--color-gold)] hover:underline"
              >
                {item.source}
              </a>
            ) : (
              item.source
            )}
          </p>
        )}
      </div>
    </div>
  );
}
