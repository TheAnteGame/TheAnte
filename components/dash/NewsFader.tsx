"use client";

import { useEffect, useState } from "react";

// Cross-fades one item per rotate interval (default 5000ms, matching the sketch).
// Pauses on hover; prefers-reduced-motion drops the fade and just swaps.

export function NewsFader({ items, rotateMs }: { items: Array<{ id: string; title: string; url: string | null }>; rotateMs: number }) {
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
      className="px-4 py-4 text-sm"
      style={{ opacity: visible ? 1 : 0, transition: reduced ? "none" : "opacity 300ms" }}
    >
      {item.url ? (
        <a href={item.url} target="_blank" rel="noreferrer" className="text-[color:var(--color-text-hi)] underline-offset-4 hover:underline">
          {item.title}
        </a>
      ) : (
        <span className="text-[color:var(--color-text-hi)]">{item.title}</span>
      )}
    </div>
  );
}
