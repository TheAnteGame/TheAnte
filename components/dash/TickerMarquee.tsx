"use client";

import { useEffect, useState } from "react";

// The broadcast crawl (art §7). Pauses on hover; prefers-reduced-motion falls back
// to a static rotating item (ANTE-PLAYER §4).

export interface TickerItem {
  id: string;
  text: string;
  url: string | null;
  source: "manual" | "system" | "feed";
}

export function TickerMarquee({
  items,
  speedSeconds,
  accentCss,
  textCss,
}: {
  items: TickerItem[];
  speedSeconds: number;
  accentCss: string;
  textCss: string;
}) {
  const [reduced, setReduced] = useState(false);
  const [staticIndex, setStaticIndex] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!reduced) return;
    const t = setInterval(() => setStaticIndex((i) => (i + 1) % items.length), 8000);
    return () => clearInterval(t);
  }, [reduced, items.length]);

  const render = (item: TickerItem, key: string) => {
    const body = (
      <span className="nums" style={{ color: item.source === "system" ? accentCss : textCss }}>
        {item.text}
      </span>
    );
    return (
      // Symmetric spacing (D-072). This was `gap-3 px-4`, which put 12px between an item
      // and its diamond and 32px between that diamond and the next item — its own right
      // padding plus the next item's left padding. The separator read as glued to the
      // text it followed rather than sitting between the two.
      //
      // The diamond is the LAST child of its item, so the gap alone only spaces it on
      // the left; pr-6 supplies the matching space on the right, before the next item
      // begins. gap-6 without pr-6 just moves the problem: 24px before, 0 after.
      <span key={key} className="inline-flex items-center gap-6 pr-6">
        {item.url ? (
          <a href={item.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
            {body}
          </a>
        ) : (
          body
        )}
        {/* A drawn diamond, not the ◆ glyph (D-072). U+25C6's ink sits low inside its
            em box, so flex `items-center` centred the line box while the mark itself
            still rode low against the text. A rotated square has no font metrics to
            fight: the box IS the mark, so centring it centres what you see, and it
            renders identically on every platform. */}
        <span
          aria-hidden
          className="inline-block h-[6px] w-[6px] shrink-0 rotate-45 bg-[color:var(--color-border)]"
        />
      </span>
    );
  };

  if (reduced) {
    return (
      <div className="panel-head px-4 py-2 text-sm">
        {render(items[staticIndex], items[staticIndex].id)}
      </div>
    );
  }

  return (
    <div
      aria-label="League ticker"
      className="overflow-hidden whitespace-nowrap panel-head py-2 text-sm"
      style={{ ["--ticker-seconds" as string]: `${speedSeconds}s` }}
    >
      <div className="ticker-track inline-block">
        {items.map((i) => render(i, i.id))}
        {items.map((i) => render(i, `${i.id}-dup`))}
      </div>
    </div>
  );
}
