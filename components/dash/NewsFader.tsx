"use client";

import { useEffect, useRef, useState } from "react";

type Item = { id: string; title: string; url: string | null; source: string | null };

// One headline at a time, with a deliberate blank beat between them.
//
// D-053 — the box was showing two stories layered over each other, each with its own
// source line. Two changes make that impossible rather than unlikely:
//
//  1. There is now a real GAP. A story fades out, the slot sits EMPTY for a full
//     second, and only then does the next one fade in. Previously the swap happened
//     the instant the fade-out timer fired, so any hiccup — a slow frame, a
//     router.refresh() landing at the wrong moment — could paint the incoming story
//     while the outgoing one was still on screen. With an empty second in between
//     there is no moment when two stories can share the box.
//
//  2. The list is frozen at mount. The dashboard polls with router.refresh() every
//     five seconds and re-renders this component with a freshly fetched array. Usually
//     identical, but when a new story lands the ORDER shifts and the rendered item
//     changes underneath the animation with no fade at all. News does not need to
//     arrive within five seconds; it can wait for the next real page load.
//
// The cycle is one self-cancelling chain rather than an interval plus a loose
// setTimeout, so pausing, unmounting or re-rendering can never leave a stray timer
// queued — that was how the box previously advanced twice or stranded a half-fade.

const FADE_MS = 400;
const GAP_MS = 1000; // the blank beat between stories

export function NewsFader({
  items,
  rotateMs,
  sourceLabel,
}: {
  items: Item[];
  rotateMs: number;
  sourceLabel: string;
}) {
  // Captured once. Later props are ignored on purpose — see note 2 above.
  const [list] = useState<Item[]>(items);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (paused || list.length <= 1) return;

    const queue = timers.current;
    const later = (fn: () => void, ms: number) => queue.push(setTimeout(fn, ms));

    const cycle = () => {
      if (reduced) {
        setIndex((i) => (i + 1) % list.length);
        later(cycle, rotateMs);
        return;
      }
      setVisible(false); // fade out
      later(() => {
        // Swap while the slot is empty, then hold the blank beat before fading in.
        setIndex((i) => (i + 1) % list.length);
        later(() => {
          setVisible(true);
          later(cycle, rotateMs + FADE_MS);
        }, GAP_MS);
      }, FADE_MS);
    };

    later(cycle, rotateMs);

    return () => {
      // Every timer this run created dies with it. Nothing can fire into a paused,
      // re-rendered or unmounted box.
      queue.forEach(clearTimeout);
      timers.current = [];
      setVisible(true);
    };
  }, [paused, list.length, rotateMs, reduced]);

  const item = list[index] ?? list[0];
  if (!item) return null;

  const headline = "leading-snug text-[color:var(--color-text-hi)]";

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // Holds its size across a swap — three headline lines plus the source line — so
      // the column below never jumps, and the blank beat never collapses the box.
      className="min-h-[7.5rem] px-4 py-4 text-sm"
    >
      <div
        // Keyed on the item: React replaces the node outright instead of mutating text
        // inside a node that is mid-transition.
        key={item.id}
        style={{
          opacity: visible ? 1 : 0,
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
