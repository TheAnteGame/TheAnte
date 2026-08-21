"use client";

import { useEffect, useState } from "react";

// Cross-fades one item per rotate interval (default 5000ms, matching the sketch).
// Pauses on hover; prefers-reduced-motion drops the fade and just swaps.

export function NewsFader({
  items,
  rotateMs,
  sourceLabel,
}: {
  items: Array<{ id: string; title: string; url: string | null; source: string | null }>;
  rotateMs: number;
  sourceLabel: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const t = setInterval(() => {
      if (reduced) {
        setIndex((i) => (i + 1) % items.length);
        return;
      }
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
        setVisible(true);
      }, 300);
    }, rotateMs);
    return () => clearInterval(t);
  }, [paused, items.length, rotateMs, reduced]);

  const item = items[index];

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // Three headline lines tall, always: the box holds its size as items rotate
      // instead of the whole right column jumping every few seconds.
      className="min-h-[6.5rem] px-4 py-4 text-sm"
    >
      <div style={{ opacity: visible ? 1 : 0, transition: reduced ? "none" : "opacity 300ms" }}>
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
          <p className="mt-1.5 text-xs text-[color:var(--color-text-low)]">
            {sourceLabel}:{" "}
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="text-[color:var(--color-gold)] underline-offset-4 hover:underline"
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
