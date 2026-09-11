"use client";

import { useEffect, useState } from "react";

type Item = { id: string; title: string; url: string | null; source: string | null };

// Four seconds on, two seconds off. Nothing else (D-077).
//
// Two previous versions cross-faded, and both could show two headlines at once. This
// one cannot, because it never describes two: the box renders EITHER one headline or
// nothing at all, and the index only moves during the empty beat. There is no fade,
// no transition, no keyed swap, no second element to collide with the first.
//
// One timeout exists at a time. It is created by the effect and cleared by the same
// effect's cleanup, so a re-render, a pause or an unmount cannot leave one queued.

const ON_MS = 4000;
const OFF_MS = 2000;

export function NewsFader({ items, sourceLabel }: { items: Item[]; sourceLabel: string }) {
  // Frozen at mount. The dashboard calls router.refresh() every five seconds and hands
  // this a freshly fetched array; when a story lands the ORDER shifts, and the visible
  // headline would change mid-beat. News can wait for the next real page load.
  const [list] = useState<Item[]>(items);
  const [index, setIndex] = useState(0);
  const [on, setOn] = useState(true);

  useEffect(() => {
    if (list.length === 0) return;
    const t = setTimeout(
      () => {
        if (on) {
          setOn(false);
        } else {
          // The index advances ONLY while the box is empty. This single line is why
          // two headlines can never be on screen together.
          setIndex((i) => (i + 1) % list.length);
          setOn(true);
        }
      },
      on ? ON_MS : OFF_MS,
    );
    return () => clearTimeout(t);
  }, [on, index, list.length]);

  const item = list[index];

  return (
    // Fixed height, so the empty beat does not collapse the box and the column below
    // never jumps: three clamped headline lines plus the source line.
    <div className="min-h-[7.5rem] px-4 py-4 text-sm">
      {on && item ? (
        <div>
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="line-clamp-3 leading-snug text-[color:var(--color-text-hi)] underline-offset-4 hover:underline"
            >
              {item.title}
            </a>
          ) : (
            <span className="line-clamp-3 leading-snug text-[color:var(--color-text-hi)]">{item.title}</span>
          )}
          {item.source && (
            <p className="mt-2 text-xs text-[color:var(--color-text-low)]">
              {sourceLabel}: <span className="text-[color:var(--color-text-mid)]">{item.source}</span>
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
