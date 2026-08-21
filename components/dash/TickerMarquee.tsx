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
      <span key={key} className="inline-flex items-center gap-3 px-4">
        {item.url ? (
          <a href={item.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
            {body}
          </a>
        ) : (
          body
        )}
        <span aria-hidden className="text-[color:var(--color-border)]">
          ◆
        </span>
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
