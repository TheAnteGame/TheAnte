"use client";

import { useEffect, useRef, useState } from "react";

type Item = { id: string; title: string; url: string | null; source: string | null };

// Cross-fades one headline at a time. Pauses on hover; prefers-reduced-motion drops
// the fade and just swaps.
//
// D-052 — three faults fixed here, all of which read to a player as "the new story
// layers over the old one":
//
//  1. The dashboard polls with router.refresh() every 5000ms and this rotated every
//     5000ms, so an RSC re-render landed on top of the fade EVERY time. The rotation
//     is now 7000ms by default — longer, as asked, and deliberately not a multiple of
//     the poll, so the two cannot stay in lockstep.
//  2. The swap was driven by a setTimeout that was never cleared. On hover, on a prop
//     change, on unmount, a pending swap still fired — advancing twice or stranding
//     the box mid-fade. It is tracked and cleared now.
//  3. A refresh handed down a NEW items array on every poll. Identical content, new
//     identity — enough to re-render the subtree mid-transition. The list is now held
//     in state and only adopted when the ids actually differ, so a no-op refresh
//     cannot disturb a fade in flight.
//
// The fade is also slower (500ms each way, eased) and the swap happens only at zero
// opacity, so two headlines can never be on screen together.

const FADE_MS = 500;

export function NewsFader({
  items,
  rotateMs,
  sourceLabel,
}: {
  items: Item[];
  rotateMs: number;
  sourceLabel: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Adopt a new list only when it is genuinely new — and do it during render, which is
  // React's documented way to adjust state on a prop change, rather than in an effect
  // that would cost a second render pass and a visible flash.
  //
  // Why pin the list at all: the poll re-renders this component every few seconds with
  // a freshly fetched array. Usually identical, but when a new story lands the ORDER
  // shifts, and items[index] would then point at different text with no fade at all —
  // a headline replaced mid-sentence, which is exactly what "it layers over the old
  // one" looks like. Pinning means the list only ever changes on our own terms.
  const [shown, setShown] = useState(items);
  if (
    shown.length !== items.length ||
    !shown.every((it, i) => it.id === items[i]?.id)
  ) {
    setShown(items);
    setIndex(0);
    setVisible(true);
  }
  const list = shown;

  useEffect(() => {
    if (paused || list.length <= 1) return;
    const tick = setInterval(() => {
      if (reduced) {
        setIndex((i) => (i + 1) % list.length);
        return;
      }
      setVisible(false);
      swapTimer.current = setTimeout(() => {
        setIndex((i) => (i + 1) % list.length);
        setVisible(true);
      }, FADE_MS);
    }, rotateMs);
    return () => {
      clearInterval(tick);
      // The swap belongs to the interval that scheduled it. Leaving it queued is what
      // let a paused or re-rendered box advance behind its own back.
      if (swapTimer.current) {
        clearTimeout(swapTimer.current);
        swapTimer.current = null;
        setVisible(true);
      }
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
      // the column below never jumps as stories rotate.
      className="min-h-[7.5rem] px-4 py-4 text-sm"
    >
      <div
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
